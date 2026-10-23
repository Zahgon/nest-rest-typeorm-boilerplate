import express, {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import * as path from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Logger as WinstonLogger } from 'winston';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { LoginDto } from './auth/dto/login.dto';
import { RegisterDto } from './auth/dto/register.dto';
import { CaslModule } from './casl/casl.module';
import { createPoliciesGuard } from './casl/policies.guard';
import { DeleteUserPolicyHandler } from './casl/policy-handlers';
import { ConfigService } from './common/config.service';
import { createLogger } from './common/logger';
import {
  allowCrossOrigin,
  createRateLimiter,
  decodeRequestPath,
  decorateTransportError,
  errorHandler,
  contentTypeCasing,
  MAX_PARAM_LENGTH,
  MCP_TRANSPORT_PATH,
  notFoundHandler,
  parseBody,
  parseUnroutedBody,
  preflight,
  routerPipeline,
  securityHeaders,
} from './common/platform';
import { setupSwagger } from './common/swagger';
import { validateBody } from './common/validation.middleware';
import { McpModule } from './mcp/mcp.module';
import { PatchUserDto } from './users/dto/patch-user.dto';
import { UserRoles } from './users/user-role.entity';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

export const OPEN_API_ROOT = 'api/v1/docs';

export interface AppModuleOptions {
  /**
   * Whether to open the database connection. Off for callers that only need the
   * wiring -- the route table, the middleware order, the error mapping.
   */
  connect?: boolean;
  /**
   * Environment overlaid on the process environment.
   */
  env?: NodeJS.ProcessEnv;
}

export interface AppContext {
  app: Express;
  config: ConfigService;
  logger: WinstonLogger;
  dataSource: DataSource;
  auth: AuthModule;
  users: UsersModule;
  casl: CaslModule;
  mcp: McpModule;
  close(): Promise<void>;
}

/**
 * Wraps a handler so anything it throws -- or rejects with -- reaches the error
 * middleware instead of escaping the request.
 */
const route =
  (
    handler: (req: Request, res: Response) => Promise<void> | void,
  ): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = handler(req, res);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };

/**
 * The composition root: builds every collaborator, wires the HTTP surface and
 * hands back the assembled application.
 *
 * Construction order is the dependency order -- configuration, logging,
 * persistence, then the feature modules that need them -- and route
 * registration order is the resolution order, which is load bearing: the
 * literal user route is declared ahead of the username pattern that would
 * otherwise swallow it.
 */
export class AppModule {
  static async create(options: AppModuleOptions = {}): Promise<AppContext> {
    const config = new ConfigService(options.env);
    const logger = createLogger(config);
    const appEnv = config.get('APP_ENV');
    const isProduction = appEnv === 'production';
    const isDevelopment = appEnv === 'development';

    const dataSource = new DataSource({
      type: config.get<'mysql' | 'mariadb' | 'postgres'>('DB_TYPE') ?? 'mysql',
      host: config.get<string>('DB_HOST'),
      port: Number(config.get('DB_PORT')),
      username: config.get<string>('DB_USERNAME'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_DATABASE'),
      entities: [User, UserRoles],
      synchronize: isDevelopment,
      logging: isDevelopment,
    });

    if (options.connect !== false) {
      await dataSource.initialize();
    }

    const casl = new CaslModule();
    const users = new UsersModule(dataSource, casl.factory);
    const auth = new AuthModule(config, users.service);
    const mcp = new McpModule(config, users.service);

    const appService = new AppService(logger);
    const appController = new AppController(appService);

    const app = express();
    app.disable('x-powered-by');
    app.disable('etag');
    // Paths match exactly: no trailing-slash or letter-case folding.
    app.enable('strict routing');
    app.enable('case sensitive routing');

    // An over-long username never matches its route, so the request is unrouted.
    app.param('username', (_req, _res, next, value: string) => {
      next(value.length > MAX_PARAM_LENGTH ? 'route' : undefined);
    });

    app.use(decodeRequestPath);
    app.use(contentTypeCasing);
    app.use(preflight);
    app.use(securityHeaders);
    app.use(allowCrossOrigin);

    const limiter = createRateLimiter();
    const pipeline = routerPipeline(limiter);
    const jwtGuard = auth.guard;

    // The transport streams straight to the socket, so it is registered before
    // the response decoration the routed endpoints get.
    app.all(
      MCP_TRANSPORT_PATH,
      limiter,
      parseBody,
      route((req, res) => mcp.controller.transport(req, res, req.body)),
      decorateTransportError,
    );

    setupSwagger(app, OPEN_API_ROOT, pipeline);

    if (isProduction) {
      app.use(express.static(path.join(__dirname, '..', 'ui')));
    }

    app.get(
      '/api',
      ...pipeline,
      route((_req, res) => {
        res.status(200).json(appController.getStartingMessage());
      }),
    );

    app.post(
      '/api/v1/auth/login',
      ...pipeline,
      validateBody(LoginDto),
      route(async (req, res) => {
        res.status(201).json(await auth.controller.login(req.body as LoginDto));
      }),
    );

    app.post(
      '/api/v1/auth/register',
      ...pipeline,
      validateBody(RegisterDto),
      route(async (req, res) => {
        res
          .status(201)
          .json(await auth.controller.register(req.body as RegisterDto));
      }),
    );

    app.get(
      '/api/v1/users/user',
      ...pipeline,
      jwtGuard,
      route((req, res) => {
        res
          .status(200)
          .json(
            users.controller.getUser((req as Request & { user: User }).user),
          );
      }),
    );

    // The username segment may be empty: `/api/v1/users/` reaches the same
    // handlers with an empty username.
    const usernameRoutes = ['/api/v1/users/:username', '/api/v1/users/'];

    app.get(
      usernameRoutes,
      ...pipeline,
      jwtGuard,
      route(async (req, res) => {
        res
          .status(200)
          .json(
            await users.controller.getUserByUsername(req.params.username ?? ''),
          );
      }),
    );

    app.patch(
      '/api/v1/users',
      ...pipeline,
      jwtGuard,
      validateBody(PatchUserDto),
      route(async (req, res) => {
        res
          .status(200)
          .json(await users.controller.patchUser(req.body as PatchUserDto));
      }),
    );

    app.delete(
      usernameRoutes,
      ...pipeline,
      jwtGuard,
      createPoliciesGuard(casl.factory, new DeleteUserPolicyHandler()),
      route(async (req, res) => {
        res
          .status(200)
          .json(
            await users.controller.deleteUserByUsername(
              req.params.username ?? '',
            ),
          );
      }),
    );

    app.get(
      '/api/v1/mcp/inventory',
      ...pipeline,
      route((_req, res) => {
        res.status(200).json(mcp.controller.inventory());
      }),
    );

    app.post(
      '/api/v1/mcp/invoke',
      ...pipeline,
      route(async (req, res) => {
        res.status(201).json(await mcp.controller.invoke(req.body));
      }),
    );

    app.get(
      '/api/v1/mcp/resource',
      ...pipeline,
      route(async (req, res) => {
        res
          .status(200)
          .json(
            await mcp.controller.resource(
              req.query.serverId as string,
              req.query.uri as string,
            ),
          );
      }),
    );

    app.post(
      '/api/v1/mcp/chat',
      ...pipeline,
      route(async (req, res) => {
        res.status(201).json(await mcp.controller.chat(req.body));
      }),
    );

    // Unrouted requests still have their payload decoded (and refused when it
    // cannot be) before they are reported as missing.
    app.use(parseUnroutedBody);
    app.use(notFoundHandler);
    app.use(errorHandler);

    await mcp.init();

    return {
      app,
      config,
      logger,
      dataSource,
      auth,
      users,
      casl,
      mcp,
      close: async (): Promise<void> => {
        await mcp.close();
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
        logger.close();
      },
    };
  }
}
