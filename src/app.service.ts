import { Logger } from 'winston';

import { IMessage } from './shared/api-types';

export class AppService {
  constructor(private readonly logger: Logger) {}

  /**
   * Greets the caller and points them at the documentation.
   */
  startingMessage(): IMessage {
    this.logger.info('Calling startingMessage -> ', AppService.name);
    return {
      message: 'Welcome to api! Navigate to api/v1/docs for documentation.',
    };
  }
}
