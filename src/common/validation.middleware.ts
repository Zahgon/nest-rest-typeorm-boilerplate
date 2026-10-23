import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { BadRequestException } from './http-exception';

type PayloadClass<T> = new () => T;

/**
 * Collapses a validation error tree into the flat list of constraint messages
 * reported to the client, parents before children.
 */
export const flattenValidationErrors = (
  errors: ValidationError[],
): string[] => {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints !== undefined) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children !== undefined && error.children.length > 0) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }

  return messages;
};

/**
 * Turns the decoded body into an instance of the payload class, rejects it if
 * any constraint fails, and hands the typed instance to the handler. Properties
 * the payload does not declare are dropped rather than refused.
 *
 * A body that did not decode to an object is validated as an empty one, so a
 * request with the wrong media type is reported as a set of missing fields
 * rather than as a parse failure.
 */
export const validateBody = <T extends object>(
  PayloadClass: PayloadClass<T>,
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const raw =
      typeof req.body === 'object' &&
      req.body !== null &&
      !Array.isArray(req.body)
        ? req.body
        : {};

    const instance = plainToInstance(PayloadClass, raw);
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      next(new BadRequestException(flattenValidationErrors(errors)));
      return;
    }

    req.body = instance;
    next();
  };
};
