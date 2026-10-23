import { ConfigService } from '../common/config.service';
import { UsersService } from '../users/users.service';
import { createJwtGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const config = new ConfigService({
      WEBTOKEN_ENCRYPTION_KEY: 'test-encryption-key',
    });
    const strategy = new JwtStrategy(config, {} as UsersService);
    expect(createJwtGuard(strategy)).toBeDefined();
  });
});
