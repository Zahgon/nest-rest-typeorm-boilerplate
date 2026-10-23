import { Repository } from 'typeorm';

import { UserRoles } from './user-role.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockedUserRepository = {};

  const mockedUserRolesRepository = {};

  beforeEach(() => {
    service = new UsersService(
      mockedUserRepository as Repository<User>,
      mockedUserRolesRepository as Repository<UserRoles>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
