import { plainToClass } from 'class-transformer';
import { Repository } from 'typeorm';

import { UserRolesEnum } from '../shared/api-types';

import { ConfigService } from '../common/config.service';
import { UserRoles } from '../users/user-role.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const user: User = plainToClass(User, {
  id: 1,
  email: 'test@user.com',
  roles: [
    {
      id: 1,
      role: UserRolesEnum.SUDO,
      user: 1,
    },
  ],
});

const userRole: UserRoles = plainToClass(UserRoles, {
  id: 1,
  role: UserRolesEnum.SUDO,
  user,
} as UserRoles);
describe('AuthService', () => {
  let service: AuthService;

  // Mock Repositories
  const mockedUserRepository = {
    createQueryBuilder: jest.fn().mockResolvedValue(user),
  };
  const mockedUserRolesRepository = {
    save: jest.fn().mockResolvedValue([userRole]),
  };

  beforeEach(() => {
    const config = new ConfigService({
      WEBTOKEN_ENCRYPTION_KEY: 'test-encryption-key',
      WEBTOKEN_EXPIRATION_TIME: '1800',
    });

    const usersService = new UsersService(
      mockedUserRepository as unknown as Repository<User>,
      mockedUserRolesRepository as unknown as Repository<UserRoles>,
    );

    service = new AuthService(config, usersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
