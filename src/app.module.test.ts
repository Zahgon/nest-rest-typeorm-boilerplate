import { Server } from 'http';
import { AddressInfo } from 'net';

import { AppContext, AppModule } from './app.module';

/**
 * Exercises the assembled application over a real socket.
 *
 * The wire contract -- status codes, headers, media types, error envelopes --
 * is produced by the server, not by the handlers, so asserting it against an
 * in-process double would prove nothing about what a client receives.
 */
interface Harness {
  baseUrl: string;
  routePaths: string[];
  stop(): Promise<void>;
}

const start = async (): Promise<Harness> => {
  const context: AppContext = await AppModule.create({
    connect: false,
    env: {
      APP_ENV: 'development',
      WEBTOKEN_ENCRYPTION_KEY: 'test-encryption-key',
      WEBTOKEN_EXPIRATION_TIME: '2400',
      MCP_CLIENT_REMOTES: '',
    },
  });

  const server: Server = context.app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  const stack = (
    context.app as unknown as {
      _router: { stack: { route?: { path: string } }[] };
    }
  )._router.stack;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    routePaths: stack
      .flatMap((layer) => {
        const path = layer.route?.path as string | string[] | undefined;
        return Array.isArray(path) ? path : [path];
      })
      .filter((path): path is string => typeof path === 'string'),
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await context.close();
    },
  };
};

const CONTENT_SECURITY_POLICY =
  "script-src-attr 'unsafe-inline';default-src 'self';base-uri 'self';" +
  "font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';" +
  "img-src 'self' data:;object-src 'none';script-src 'self';" +
  "style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests";

describe('HTTP surface', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await start();
  });

  afterAll(async () => {
    await harness.stop();
  });

  const get = (path: string, init?: RequestInit): Promise<Response> =>
    fetch(`${harness.baseUrl}${path}`, init);

  describe('routing', () => {
    it('serves the greeting under the api prefix', async () => {
      const response = await get('/api');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(
        'application/json; charset=utf-8',
      );
      expect(await response.json()).toEqual({
        message: 'Welcome to api! Navigate to api/v1/docs for documentation.',
      });
    });

    it('does not serve the greeting outside the api prefix', async () => {
      expect((await get('/')).status).toBe(404);
    });

    it('resolves the literal user route ahead of the username pattern', () => {
      const literal = harness.routePaths.indexOf('/api/v1/users/user');
      const pattern = harness.routePaths.indexOf('/api/v1/users/:username');

      expect(literal).toBeGreaterThanOrEqual(0);
      expect(pattern).toBeGreaterThanOrEqual(0);
      expect(literal).toBeLessThan(pattern);
    });

    it('matches paths exactly, without trailing-slash or case folding', async () => {
      expect((await get('/api/')).status).toBe(404);
      expect((await get('/API')).status).toBe(404);
    });

    it('routes on the decoded path and refuses an undecodable one', async () => {
      expect((await get('/%61pi')).status).toBe(200);

      const response = await get('/api/%zz');
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(await response.json()).toEqual({
        error: 'Bad Request',
        code: 'FST_ERR_BAD_URL',
        message: "'/api/%zz' is not a valid url component",
        statusCode: 400,
      });
    });

    it('does not match a username parameter longer than 100 characters', async () => {
      const response = await get(`/api/v1/users/${'a'.repeat(101)}`);
      expect(response.status).toBe(404);
    });

    it('reports an unrouted request with an undecodable media type as missing', async () => {
      const response = await get('/api/nope', {
        method: 'POST',
        headers: { 'content-type': 'text/xml' },
        body: '<a/>',
      });
      expect(response.status).toBe(404);
    });

    it('refuses an empty JSON payload and closes the connection', async () => {
      const response = await get('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      });
      expect(response.status).toBe(400);
      expect(response.headers.get('connection')).toBe('close');
      expect(await response.json()).toEqual({
        statusCode: 400,
        message:
          "Body cannot be empty when content-type is set to 'application/json'",
      });
    });

    it('refuses a JSON payload that carries a prototype', async () => {
      const response = await get('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"__proto__":{"admin":true}}',
      });
      expect(response.status).toBe(400);
    });

    it('reports an unknown route with the method and the url asked for', async () => {
      const response = await get('/api/v1/does-not-exist');

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        message: 'Cannot GET /api/v1/does-not-exist',
        error: 'Not Found',
        statusCode: 404,
      });
    });

    it('reports an unsupported method on a known path as a missing route', async () => {
      const response = await get('/api', { method: 'DELETE' });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        message: 'Cannot DELETE /api',
        error: 'Not Found',
        statusCode: 404,
      });
    });
  });

  describe('response decoration', () => {
    it('publishes the security policy on routed responses', async () => {
      const response = await get('/api');

      expect(response.headers.get('content-security-policy')).toBe(
        CONTENT_SECURITY_POLICY,
      );
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('publishes the security policy on unrouted responses too', async () => {
      const response = await get('/nope');

      expect(response.headers.get('content-security-policy')).toBe(
        CONTENT_SECURITY_POLICY,
      );
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('counts routed requests against the rate limit', async () => {
      const response = await get('/api');

      expect(response.headers.get('x-ratelimit-limit')).toBe('100');
      expect(response.headers.get('x-ratelimit-reset')).not.toBeNull();
    });

    it('does not count unrouted requests against the rate limit', async () => {
      const response = await get('/nope');

      expect(response.headers.get('x-ratelimit-limit')).toBeNull();
    });
  });

  describe('cross-origin preflight', () => {
    it('answers an announced preflight without the rest of the response decoration', async () => {
      const response = await get('/api', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET,HEAD,POST',
      );
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'content-type,authorization',
      );
      expect(response.headers.get('vary')).toBe(
        'Access-Control-Request-Headers',
      );
      expect(response.headers.get('content-security-policy')).toBeNull();
    });

    it('rejects an options request that is not a preflight', async () => {
      const response = await get('/api', { method: 'OPTIONS' });

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toBe('text/plain');
      expect(await response.text()).toBe('Invalid Preflight Request');
    });
  });

  describe('request bodies', () => {
    it('refuses a media type it cannot decode before routing', async () => {
      const response = await get('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/xml' },
        body: '<a/>',
      });

      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({
        statusCode: 415,
        message: 'Unsupported Media Type',
      });
    });

    it('reports a malformed payload as a decode failure', async () => {
      const response = await get('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        statusCode: 400,
        message:
          "Body is not valid JSON but content-type is set to 'application/json'",
      });
    });

    it('validates a payload sent under a decodable but unparsed media type as empty', async () => {
      const response = await get('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: [
          'username should not be empty',
          'username must contain only letters and numbers',
          'password must be longer than or equal to 8 characters',
          'password should not be empty',
        ],
        error: 'Bad Request',
        statusCode: 400,
      });
    });

    it('reports every failing constraint in declaration order', async () => {
      const response = await get('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          username: 'validuser',
          name: 'Not A Name 1',
          password: 'short',
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: [
          'email must be an email',
          'name must match /^[a-zA-Z ]+$/ regular expression',
          'password must be longer than or equal to 8 characters',
        ],
        error: 'Bad Request',
        statusCode: 400,
      });
    });
  });

  describe('authentication', () => {
    it.each([
      ['GET', '/api/v1/users/user'],
      ['GET', '/api/v1/users/someone'],
      ['PATCH', '/api/v1/users'],
      ['DELETE', '/api/v1/users/someone'],
    ])('refuses %s %s without a token', async (method, path) => {
      const response = await get(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('refuses a token it cannot verify', async () => {
      const response = await get('/api/v1/users/user', {
        headers: { authorization: 'Bearer not-a-token' },
      });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it.each([['/api'], ['/api/v1/mcp/inventory'], ['/api/v1/docs-json']])(
      'leaves %s reachable without a token',
      async (path) => {
        expect((await get(path)).status).toBe(200);
      },
    );
  });

  describe('model context protocol', () => {
    it('reports the local server in the inventory', async () => {
      const response = await get('/api/v1/mcp/inventory');
      const inventory = (await response.json()) as {
        servers: { id: string; connected: boolean }[];
        tools: { name: string }[];
        resources: { uri: string }[];
        prompts: unknown[];
      };

      expect(response.status).toBe(200);
      expect(inventory.servers.map((server) => server.id)).toEqual(['local']);
      expect(inventory.tools.map((tool) => tool.name).sort()).toEqual([
        'get-user',
        'list-users',
      ]);
      expect(
        inventory.resources.map((resource) => resource.uri).sort(),
      ).toEqual(['mcp://nest/schema/users', 'mcp://nest/server-info']);
      // Prompts are gathered from remote servers only, so the local server is
      // absent from this list however many prompts it registers.
      expect(inventory.prompts).toEqual([]);
    });

    it('requires both query parameters to read a resource', async () => {
      const response = await get('/api/v1/mcp/resource');

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'Both "serverId" and "uri" query parameters are required.',
        error: 'Bad Request',
        statusCode: 400,
      });
    });

    it('answers a tool invocation as created', async () => {
      const response = await get('/api/v1/mcp/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serverId: 'local', name: 'no-such-tool' }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'MCP tool execution failed.' }],
      });
    });

    it('leaves the streaming transport undecorated', async () => {
      const response = await get('/api/v1/mcp/transport');

      expect(response.status).toBe(406);
      expect(response.headers.get('x-ratelimit-limit')).toBeNull();
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('documentation', () => {
    it('serves the shell page as html', async () => {
      const response = await get('/api/v1/docs');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
    });

    it('serves the browser assets alongside the page', async () => {
      const response = await get('/api/v1/docs/swagger-ui.css');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(
        'text/css; charset=utf-8',
      );
    });

    it('serves the document under the api prefix', async () => {
      const response = await get('/api/v1/docs-json');
      const document = (await response.json()) as {
        servers: { url: string }[];
        paths: Record<string, unknown>;
      };

      expect(response.status).toBe(200);
      expect(document.servers).toEqual([{ url: '/api' }]);
      expect(Object.keys(document.paths)).toEqual([
        '/api',
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/users/user',
        '/api/v1/users/{username}',
        '/api/v1/users',
        '/api/v1/mcp/inventory',
        '/api/v1/mcp/invoke',
        '/api/v1/mcp/resource',
        '/api/v1/mcp/chat',
        '/api/v1/mcp/transport',
      ]);
    });
  });
});
