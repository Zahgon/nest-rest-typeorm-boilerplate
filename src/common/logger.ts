import * as winston from 'winston';
import 'winston-daily-rotate-file';

import { ConfigService } from './config.service';

/**
 * Application logging: readable lines while developing, structured records with
 * rotating files in production so operators get something machine-parseable
 * that does not grow without bound.
 */
export const createLogger = (config: ConfigService): winston.Logger => {
  const isProduction = config.get('APP_ENV') === 'production';

  if (!isProduction) {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple(),
      ),
      defaultMeta: { service: 'nest-typeorm-service' },
      transports: [new winston.transports.Console()],
    });
  }

  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    defaultMeta: { service: 'nest-typeorm-service' },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
      }),
    ],
  });
};

const write = (level: string, context: string, message: unknown): void => {
  process.stdout.write(
    `${new Date().toISOString()} ${level} [${context}] ${String(message)}\n`,
  );
};

/**
 * Lifecycle logging for components that report on themselves by name. Separate
 * from the application logger above because these lines describe the process
 * starting up rather than the work it does.
 */
export class Logger {
  constructor(private readonly context: string) {}

  log(message: unknown): void {
    write('LOG', this.context, message);
  }

  warn(message: unknown): void {
    write('WARN', this.context, message);
  }

  error(message: unknown): void {
    write('ERROR', this.context, message);
  }

  debug(message: unknown): void {
    write('DEBUG', this.context, message);
  }

  static log(message: unknown, context = 'Application'): void {
    write('LOG', context, message);
  }
}
