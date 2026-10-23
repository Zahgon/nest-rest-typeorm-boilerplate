import * as jwt from 'jsonwebtoken';

import { ConfigService } from '../common/config.service';
import { UnauthorizedException } from '../common/http-exception';
import { IJWTResponseBody } from '../shared/api-types';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export class AuthService {
  private readonly expiration: number;
  private readonly secret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.expiration = Number(
      this.configService.get('WEBTOKEN_EXPIRATION_TIME'),
    );
    this.secret = this.configService.get<string>(
      'WEBTOKEN_ENCRYPTION_KEY',
    ) as string;
  }

  /**
   * Issues a web token for a user, together with the lifetime it was issued
   * for -- both as a number of seconds and as a date the caller can display.
   */
  async createToken({
    id,
    username,
    name,
    roles,
    email,
  }: User): Promise<IJWTResponseBody> {
    const expirationFormatted = dateFormatter.format(
      new Date(Date.now() + this.expiration * 1000),
    );
    const token = await new Promise<string>((resolve, reject) => {
      jwt.sign(
        { id, username, name, roles, email },
        this.secret,
        { expiresIn: this.expiration },
        (error, encoded) => {
          if (error !== null || encoded === undefined) {
            reject(error ?? new Error('The token could not be signed'));
            return;
          }
          resolve(encoded);
        },
      );
    });

    return { expiration: this.expiration, expirationFormatted, token };
  }

  /**
   * Resolves a set of credentials into the user they belong to.
   */
  async validateUser({ username, password }: LoginDto): Promise<User> {
    const user = await this.usersService.getByUsernameAndPass(
      username,
      password,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Could not authenticate. Please try again',
      );
    }

    return user;
  }
}
