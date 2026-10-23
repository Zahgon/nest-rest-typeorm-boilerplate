import { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import helmet from 'helmet';
import * as querystring from 'querystring';

import {
  ContentParserException,
  HttpException,
  PlatformException,
} from './http-exception';
import { Logger } from './logger';

/**
 * Request bodies are only decoded for these media types (matched on the media
 * type alone, parameters such as the charset are ignored). Anything else on a
 * body-bearing request is rejected before validation.
 */
export const PARSEABLE_MEDIA_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
];

/**
 * The largest payload accepted, in bytes.
 */
export const BODY_LIMIT = 1048576;

/**
 * The streaming transport writes directly to the socket, so the usual response
 * decoration has to stay away from it.
 */
export const MCP_TRANSPORT_PATH = '/api/v1/mcp/transport';

const PREFLIGHT_METHODS = 'GET,HEAD,POST';

/**
 * Cross-origin preflight is answered before anything else and terminates the
 * request, so preflight responses carry neither security headers nor rate
 * limit counters. A request that announces itself as a preflight gets the
 * allowances; anything else arriving as OPTIONS is rejected as malformed.
 */
export const preflight = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.method !== 'OPTIONS') {
    next();
    return;
  }

  const requestMethod = req.headers['access-control-request-method'];
  if (req.headers.origin === undefined || requestMethod === undefined) {
    const body = 'Invalid Preflight Request';
    res.statusCode = 400;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('content-type', 'text/plain');
    res.setHeader('content-length', String(Buffer.byteLength(body)));
    res.end(body);
    return;
  }

  const requestHeaders = req.headers['access-control-request-headers'];
  res.statusCode = 204;
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', PREFLIGHT_METHODS);
  res.setHeader('vary', 'Access-Control-Request-Headers');
  if (requestHeaders !== undefined) {
    res.setHeader('access-control-allow-headers', requestHeaders);
  }
  res.setHeader('content-length', '0');
  res.end();
};

/**
 * The content security policy is spelled out in full rather than layered on top
 * of the library defaults, because the served directive string -- including the
 * order the directives appear in -- is part of the published response.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'script-src-attr': ["'unsafe-inline'"],
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'font-src': ["'self'", 'https:', 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'object-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", 'https:', "'unsafe-inline'"],
      'upgrade-insecure-requests': [],
    },
  },
});

/**
 * Characters whose percent-encoding is kept while the path is decoded for
 * routing, so they cannot change the shape of the path; they are decoded only
 * inside a route parameter. `%25` stays encoded so nothing is decoded twice.
 */
const RESERVED_ESCAPE = /^%(2[3-6bBcCfF]|3[aAbBdDfF]|40)$/;

/**
 * Routing works on the decoded path: an encoded letter reaches the same route
 * as the plain one. A path that cannot be decoded is refused outright, before
 * any other processing, with the router's own report.
 */
export const decodeRequestPath = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const url = req.url;
  let end = url.length;
  for (let i = 1; i < url.length; i++) {
    if (url[i] === '?' || url[i] === '#') {
      end = i;
      break;
    }
  }
  const rawPath = url.slice(0, end);
  const query = end < url.length ? url.slice(end + 1) : undefined;

  if (!rawPath.includes('%')) {
    next();
    return;
  }

  let needsDecoding = false;
  let protectedPath = '';
  for (let i = 0; i < rawPath.length; i++) {
    if (rawPath[i] === '%' && i > 0) {
      const escape = rawPath.slice(i, i + 3);
      if (RESERVED_ESCAPE.test(escape)) {
        protectedPath += escape === '%25' ? '%2525' : escape;
        if (escape === '%25') {
          needsDecoding = true;
        }
        i += 2;
        continue;
      }
      needsDecoding = true;
    }
    protectedPath += rawPath[i];
  }

  let decoded = rawPath;
  if (needsDecoding) {
    try {
      decoded = decodeURI(protectedPath);
    } catch {
      const body = JSON.stringify({
        error: 'Bad Request',
        code: 'FST_ERR_BAD_URL',
        message: `'${rawPath}' is not a valid url component`,
        statusCode: 400,
      });
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      res.setHeader('content-length', String(Buffer.byteLength(body)));
      res.end(body);
      return;
    }
  }

  req.url = query === undefined ? decoded : `${decoded}?${query}`;
  next();
};

/**
 * Route parameters longer than this are not matched at all, so the request is
 * reported as unrouted.
 */
export const MAX_PARAM_LENGTH = 100;

/**
 * Emits the media type header under a single spelling regardless of which layer
 * writes it, so the response is announced identically whether it comes from a
 * route, the static file server or the error handler.
 */
export const contentTypeCasing = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // The transport writes its own headers verbatim.
  if (req.path === MCP_TRANSPORT_PATH) {
    next();
    return;
  }
  const setHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: number | string | string[]) => {
    if (name.toLowerCase() !== 'content-type') {
      return setHeader(name, value);
    }
    const normalised =
      typeof value === 'string'
        ? value.replace(
            /charset=([\w-]+)/i,
            (_match, charset: string) => `charset=${charset.toLowerCase()}`,
          )
        : value;
    return setHeader('content-type', normalised);
  }) as Response['setHeader'];
  next();
};

/**
 * Every response is readable from any origin.
 */
export const allowCrossOrigin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.path !== MCP_TRANSPORT_PATH) {
    res.setHeader('access-control-allow-origin', '*');
  }
  next();
};

interface RateLimitState {
  limit: number;
  remaining: number;
  resetTime?: Date;
}

const rateLimitState = (req: Request): RateLimitState | undefined =>
  (req as Request & { rateLimit?: RateLimitState }).rateLimit;

const remainingSeconds = (resetTime?: Date): number => {
  if (resetTime === undefined) {
    return 0;
  }
  return Math.max(0, Math.floor((resetTime.getTime() - Date.now()) / 1000));
};

/**
 * A hundred requests a minute, counted per client.
 */
export const createRateLimiter = (): RateLimitRequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const state = rateLimitState(req);
      const reset = remainingSeconds(state?.resetTime);
      res.setHeader('x-ratelimit-limit', String(state?.limit ?? 100));
      res.setHeader('x-ratelimit-remaining', '0');
      res.setHeader('x-ratelimit-reset', String(reset));
      res.setHeader('retry-after', String(reset));
      res.status(429).json({
        statusCode: 429,
        message: `Rate limit exceeded, retry in ${reset} seconds`,
      });
    },
  });

/**
 * The rate limit counters are only advertised on requests that actually reach a
 * route, which is why they are published here rather than inside the limiter.
 */
export const rateLimitHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const state = rateLimitState(req);
  if (state !== undefined) {
    res.setHeader('x-ratelimit-limit', String(state.limit));
    res.setHeader('x-ratelimit-remaining', String(state.remaining));
    res.setHeader(
      'x-ratelimit-reset',
      String(remainingSeconds(state.resetTime)),
    );
  }
  next();
};

const PARSED = Symbol('bodyParsed');

const tooLarge = (): ContentParserException =>
  new ContentParserException(413, 'Request body is too large');

const readBody = (req: Request): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const declared = req.headers['content-length'];
    if (declared !== undefined && Number(declared) > BODY_LIMIT) {
      reject(tooLarge());
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer): void => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        finish(tooLarge());
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = (): void => finish();
    const onError = (error: Error): void => finish(error);
    function finish(error?: unknown): void {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      if (error === undefined) {
        resolve(Buffer.concat(chunks));
        return;
      }
      // The rest of an oversized payload is read and discarded.
      req.resume();
      reject(error);
    }
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });

/**
 * True when a decoded JSON value smuggles a prototype: a `__proto__` key, or a
 * `constructor` key holding a `prototype`.
 */
const hasPrototypePoisoning = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (key === '__proto__') {
      return true;
    }
    if (
      key === 'constructor' &&
      child !== null &&
      typeof child === 'object' &&
      Object.prototype.hasOwnProperty.call(child, 'prototype')
    ) {
      return true;
    }
    if (hasPrototypePoisoning(child)) {
      return true;
    }
  }
  return false;
};

const INVALID_JSON =
  "Body is not valid JSON but content-type is set to 'application/json'";

const decodeJson = (raw: Buffer): unknown => {
  let text = raw.toString('utf8');
  if (text.length === 0) {
    throw new ContentParserException(
      400,
      "Body cannot be empty when content-type is set to 'application/json'",
    );
  }
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ContentParserException(400, INVALID_JSON);
  }
  if (hasPrototypePoisoning(value)) {
    throw new ContentParserException(400, INVALID_JSON);
  }
  return value;
};

const decoders: Record<string, (raw: Buffer) => unknown> = {
  'application/json': decodeJson,
  'application/x-www-form-urlencoded': (raw) => ({
    ...querystring.parse(raw.toString('utf8')),
  }),
  'text/plain': (raw) => raw.toString('utf8'),
};

/**
 * Decodes the request body once, for routed and unrouted requests alike.
 *
 * GET and HEAD bodies are never read. A body-bearing request without a media
 * type is accepted only when it carries no payload; otherwise, and for any
 * media type outside the decodable set, it is refused as unsupported -- except
 * on an unrouted request, which is then simply reported as missing. A payload
 * of a decodable type is decoded (and refused when it cannot be) either way. A
 * request without a payload leaves the body undefined.
 */
const bodyParser =
  (unrouted: boolean): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const state = req as Request & { [PARSED]?: boolean };
    if (state[PARSED]) {
      next();
      return;
    }
    state[PARSED] = true;
    req.body = undefined;

    if (req.method === 'GET' || req.method === 'HEAD') {
      next();
      return;
    }

    const header = req.headers['content-type'];
    if (header === undefined) {
      const length = req.headers['content-length'];
      if (
        req.headers['transfer-encoding'] === undefined &&
        (length === undefined || length === '0')
      ) {
        next();
        return;
      }
      next(
        unrouted
          ? undefined
          : new PlatformException(415, 'Unsupported Media Type'),
      );
      return;
    }

    const decode = decoders[header.split(';')[0].trim().toLowerCase()];
    if (decode === undefined) {
      next(
        unrouted
          ? undefined
          : new PlatformException(415, 'Unsupported Media Type'),
      );
      return;
    }

    readBody(req).then((raw) => {
      try {
        req.body = decode(raw);
      } catch (error) {
        next(error);
        return;
      }
      next();
    }, next);
  };

export const parseBody = bodyParser(false);
export const parseUnroutedBody = bodyParser(true);

/**
 * The middleware every routed request passes through, in order.
 */
export const routerPipeline = (
  limiter: RateLimitRequestHandler,
): RequestHandler[] => [limiter, rateLimitHeaders, parseBody];

/**
 * The transport writes its answers straight to the socket, undecorated. An
 * answer the HTTP layer produces for it instead -- a payload the decoder
 * refused, before the transport ran -- is decorated like any routed answer:
 * the cross-origin allowance, then the rate limit counters.
 */
export const decorateTransportError = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!res.headersSent) {
    res.setHeader('access-control-allow-origin', '*');
    rateLimitHeaders(req, res, () => undefined);
  }
  next(error);
};

/**
 * Unrouted requests are reported as a missing resource naming the method and
 * the URL that was asked for.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: 'Not Found',
    statusCode: 404,
  });
};

const exceptionsLogger = new Logger('ExceptionsHandler');

/**
 * The single place a thrown error becomes a response. Errors that already know
 * their envelope are serialised as-is (a payload the decoder refused also
 * closes the connection); anything unrecognised is logged and degrades to a
 * server error.
 */
export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ContentParserException) {
    res.setHeader('connection', 'close');
  }

  if (error instanceof HttpException) {
    res.status(error.status).json(error.body);
    return;
  }

  exceptionsLogger.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  res.status(500).json({ statusCode: 500, message: 'Internal server error' });
};
