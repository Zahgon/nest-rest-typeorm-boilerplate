import { Repository } from 'typeorm';

import { UserRoles } from './user-role.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockedUserRepository = {};

  const mockedUserRolesRepository = {};

  beforeEach(() => {
    const service = new UsersService(
      mockedUserRepository as Repository<User>,
      mockedUserRolesRepository as Repository<UserRoles>,
    );

    controller = new UsersController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
