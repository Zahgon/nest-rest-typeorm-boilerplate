import express, {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import * as yaml from 'js-yaml';
import * as path from 'path';

import { notFoundHandler } from './platform';
import { swaggerDocument } from './swagger-document';
import { swaggerUiHtml } from './swagger-ui.html';
import { swaggerUiInit } from './swagger-ui-init';
import { NotFoundException } from './http-exception';

const swaggerUiAssetPath = (): string =>
  path.dirname(require.resolve('swagger-ui-dist/package.json'));

/**
 * Writes a fixed payload under an exact media type (no charset is appended).
 */
const sendExact =
  (contentType: string, payload: () => string): RequestHandler =>
  (_req: Request, res: Response) => {
    const body = Buffer.from(payload(), 'utf8');
    res.setHeader('content-type', contentType);
    res.setHeader('content-length', String(body.length));
    res.end(body);
  };

/**
 * Publishes the API documentation at `route`:
 *
 * - the UI page at `<route>` and `<route>/index.html` (assets referenced via
 *   `./docs/`), and at `<route>/` (assets referenced via `./`);
 * - the bootstrap script at `<route>/swagger-ui-init.js` and
 *   `<route>/docs/swagger-ui-init.js`;
 * - the OpenAPI document as JSON at `<route>-json` and as YAML at
 *   `<route>-yaml`;
 * - every other path below `<route>/` from the UI asset package, unknown files
 *   being reported as unrouted;
 * - `<route>/LICENSE` as a declared route that answers not found, so the asset
 *   package's licence file is not published.
 *
 * Each of these is a routed endpoint and goes through `pipeline` first.
 *
 * @param app      the application to mount on
 * @param route    the documentation path, without leading or trailing slashes
 * @param pipeline the middleware every routed request passes through
 */
export const setupSwagger = (
  app: Express,
  route: string,
  pipeline: RequestHandler[],
): void => {
  const root = `/${route}`;
  const trailingSlashHtml = swaggerUiHtml.replace(/\.\/docs\//g, './');
  const yamlDocument = yaml.dump(swaggerDocument, {
    skipInvalid: true,
    noRefs: true,
  });

  const initScript = sendExact('application/javascript', swaggerUiInit);
  app.get(`${root}/swagger-ui-init.js`, ...pipeline, initScript);
  app.get(`${root}/docs/swagger-ui-init.js`, ...pipeline, initScript);

  app.get(
    root,
    ...pipeline,
    sendExact('text/html', () => swaggerUiHtml),
  );
  app.get(
    `${root}/index.html`,
    ...pipeline,
    sendExact('text/html', () => swaggerUiHtml),
  );
  app.get(
    `${root}/`,
    ...pipeline,
    sendExact('text/html', () => trailingSlashHtml),
  );
  app.get(`${root}/LICENSE`, ...pipeline, (_req, _res, next) => {
    next(new NotFoundException());
  });

  app.get(`${root}-json`, ...pipeline, (_req: Request, res: Response) => {
    res.json(swaggerDocument);
  });
  app.get(
    `${root}-yaml`,
    ...pipeline,
    sendExact('text/yaml', () => yamlDocument),
  );

  const assets = express.static(swaggerUiAssetPath(), {
    index: false,
    redirect: false,
  });
  app.get(
    `${root}/*`,
    ...pipeline,
    (req: Request, res: Response, next: NextFunction) => {
      const url = req.url;
      req.url = url.slice(root.length);
      assets(req, res, (error?: unknown) => {
        req.url = url;
        next(error);
      });
    },
    notFoundHandler,
  );
};
