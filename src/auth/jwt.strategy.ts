import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';

import { ConfigService } from '../common/config.service';
import { UnauthorizedException } from '../common/http-exception';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

/**
 * The payload carried inside an issued web token.
 */
export interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

/**
 * Resolves a bearer token into the user it was issued for.
 *
 * The strategy is built here and handed to whoever needs to authenticate a
 * request, so the signing secret is read once and the token-to-user lookup
 * lives next to the rest of the authentication code.
 */
export class JwtStrategy {
  readonly strategy: Strategy;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = this.configService.get<string>('WEBTOKEN_ENCRYPTION_KEY');
    if (!secret) {
      throw new Error('WEBTOKEN_ENCRYPTION_KEY is not configured');
    }

    this.strategy = new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: secret,
      } satisfies StrategyOptionsWithoutRequest,
      (
        payload: JwtPayload,
        done: (error: unknown, user?: User | false) => void,
      ) => {
        this.validate(payload)
          .then((user) => done(null, user))
          .catch((error) => done(error, false));
      },
    );
  }

  async validate({ id }: JwtPayload): Promise<User> {
    const user = await this.usersService.get(id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
