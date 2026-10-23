import { NextFunction, Request, RequestHandler, Response } from 'express';

import { ForbiddenException } from '../common/http-exception';
import { User } from '../users/user.entity';
import { AppAbility, CaslFactory } from './casl.factory';
import { PolicyHandler } from './policy-handlers';

const execPolicyHandler = (
  handler: PolicyHandler,
  ability: AppAbility,
): boolean => {
  if (typeof handler === 'function') {
    return handler(ability);
  }
  return handler.handle(ability);
};

/**
 * Refuses the request unless every supplied policy holds for the authenticated
 * user's abilities. Attach it after the authentication guard, whose job it is
 * to put the user on the request in the first place.
 */
export const createPoliciesGuard = (
  caslFactory: CaslFactory,
  ...policyHandlers: PolicyHandler[]
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as Request & { user: User }).user;
    const ability = caslFactory.createForUser(user);

    if (
      policyHandlers.every((handler) => execPolicyHandler(handler, ability))
    ) {
      next();
      return;
    }

    next(new ForbiddenException());
  };
};
