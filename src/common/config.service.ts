import * as dotenv from 'dotenv';
import * as joi from 'joi';

/**
 * The environment contract. Every key the application reads is declared here
 * with its default, so a missing optional variable is a decision recorded in
 * one place rather than a fallback scattered through the code.
 */
export const configValidationSchema = joi.object({
  APP_ENV: joi
    .string()
    .valid('development', 'production')
    .default('development'),
  PORT: joi.number().default(3333),
  WEBTOKEN_ENCRYPTION_KEY: joi.string().required(),
  WEBTOKEN_EXPIRATION_TIME: joi.number().default(1800),
  DB_TYPE: joi.string().valid('mysql', 'mariadb', 'postgres').default('mysql'),
  DB_USERNAME: joi.string().default('root'),
  DB_PASSWORD: joi.string().allow('').default(''),
  DB_HOST: joi.string().default('localhost'),
  DB_PORT: joi.number().default(3306),
  DB_DATABASE: joi.string().default('nest'),
  MCP_SERVER_NAME: joi.string().default('nest-rest-typeorm-mcp'),
  MCP_SERVER_VERSION: joi.string().default('1.0.0'),
  MCP_CLIENT_REMOTES: joi.string().allow('').default(''),
});

/**
 * Reads, validates and caches the environment once at construction. Validation
 * failure is fatal: the process must not start with an environment it cannot
 * describe.
 *
 * An explicit environment can be supplied to layer over the process one, which
 * is what lets tests build the application without touching the host.
 */
export class ConfigService {
  private readonly values: Record<string, unknown>;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    dotenv.config();

    const { error, value } = configValidationSchema.validate(
      { ...process.env, ...env },
      { allowUnknown: true, abortEarly: false },
    );

    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }

    this.values = value as Record<string, unknown>;
  }

  get<T = string>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}
