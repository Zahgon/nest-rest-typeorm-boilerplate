import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeAll(() => {
    const appService = {
      startingMessage: jest.fn().mockResolvedValue({
        message: 'Welcome to api! Navigate to api/v1/docs for documentation.',
      }),
    } as unknown as AppService;

    controller = new AppController(appService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStartingMessage', () => {
    it('should return "Welcome to api! Navigate to api/v1/docs for documentation."', async () => {
      expect(await controller.getStartingMessage()).toEqual({
        message: 'Welcome to api! Navigate to api/v1/docs for documentation.',
      });
    });
  });
});
