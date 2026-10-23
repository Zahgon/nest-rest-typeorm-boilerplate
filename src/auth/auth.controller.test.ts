import { IJWTResponseBody, UserRolesEnum } from '../shared/api-types';

import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    const authService = {
      valideUser: jest.fn().mockResolvedValue({
        id: 1,
        username: 'test-user',
        email: 'test@user.com',
        name: 'Test User',
        gravatar: 'https://www.gravatar.com/avatar/',
        roles: [
          {
            id: 1,
            role: UserRolesEnum.SUDO,
            user: 1,
          },
        ],
      }),
      createToken: jest.fn().mockResolvedValue({
        expiration: 1800,
        expirationFormatted: 'in 30 minutes',
        token: 'JWT',
      } as IJWTResponseBody),
    } as unknown as AuthService;

    const usersService = {} as UsersService;

    controller = new AuthController(authService, usersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
