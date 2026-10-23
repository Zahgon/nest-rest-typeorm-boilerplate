import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Passport } from 'passport';

import { UnauthorizedException } from '../common/http-exception';
import { User } from '../users/user.entity';
import { JwtStrategy } from './jwt.strategy';

/**
 * Guards the routes it is attached to: the request must carry a bearer token
 * that resolves to a known user, otherwise it is refused before the handler
 * runs. The authenticated user is left on the request for the handler to use.
 *
 * The strategy is registered on a private passport instance so authentication
 * state never leaks between applications built in the same process.
 */
export const createJwtGuard = (provider: JwtStrategy): RequestHandler => {
  const passport = new Passport();
  passport.use('jwt', provider.strategy);

  return (req: Request, _res: Response, next: NextFunction): void => {
    passport.authenticate(
      'jwt',
      { session: false },
      (error: unknown, user: User | false) => {
        if (error || !user) {
          next(new UnauthorizedException());
          return;
        }
        (req as Request & { user: User }).user = user;
        next();
      },
    )(req, _res, next);
  };
};
