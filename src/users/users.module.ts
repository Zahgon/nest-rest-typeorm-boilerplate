import { DataSource } from 'typeorm';

import { CaslFactory } from '../casl/casl.factory';
import { UserRoles } from './user-role.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Owns the user records and the ability factory used to authorise operations
 * on them.
 */
export class UsersModule {
  readonly service: UsersService;
  readonly controller: UsersController;
  readonly caslFactory: CaslFactory;

  constructor(dataSource: DataSource, caslFactory: CaslFactory) {
    this.service = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(UserRoles),
    );
    this.controller = new UsersController(this.service);
    this.caslFactory = caslFactory;
  }
}
