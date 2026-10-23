import { RequestHandler } from 'express';

import { ConfigService } from '../common/config.service';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { createJwtGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

/**
 * Owns authentication: issuing tokens, resolving credentials, and the guard
 * other modules attach to the routes they want protected.
 */
export class AuthModule {
  readonly service: AuthService;
  readonly strategy: JwtStrategy;
  readonly controller: AuthController;
  readonly guard: RequestHandler;

  constructor(config: ConfigService, usersService: UsersService) {
    this.service = new AuthService(config, usersService);
    this.strategy = new JwtStrategy(config, usersService);
    this.controller = new AuthController(this.service, usersService);
    this.guard = createJwtGuard(this.strategy);
  }
}
