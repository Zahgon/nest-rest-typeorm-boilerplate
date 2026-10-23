import { AppModule, OPEN_API_ROOT } from './app.module';
import { Logger } from './common/logger';

export { OPEN_API_ROOT };
export const OPEN_API_NAME = 'API';
export const OPEN_API_DESCRIPTION = 'API Description';
export const OPEN_API_CURRENT_VERSION = '1.0';
export const KEEP_ALIVE_TIMEOUT_MS = 72_000;

async function bootstrap(): Promise<void> {
  const context = await AppModule.create();
  const port = Number(context.config.get('PORT')) || 3333;

  await new Promise<void>((resolve) => {
    const server = context.app.listen(port, '0.0.0.0', resolve);
    // Idle keep-alive connections are held for 72 seconds, as announced in the
    // Keep-Alive response header. Neither a connection nor a whole request has
    // a deadline, and request headers keep Node's 60-second limit.
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.requestTimeout = 0;
    server.setTimeout(0);
  });

  Logger.log(
    `Application is running on: http://localhost:${port}/api`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
