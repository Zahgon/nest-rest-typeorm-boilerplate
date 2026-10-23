import { AppService } from './app.service';
import { IMessage } from './shared/api-types';

export class AppController {
  constructor(private readonly appService: AppService) {}

  getStartingMessage(): IMessage {
    return this.appService.startingMessage();
  }
}
