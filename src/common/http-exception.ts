/**
 * HTTP errors carry both the status code and the exact body that should be
 * serialised for the client. Keeping the body on the error means the error
 * handler never has to reconstruct an envelope, and every call site can decide
 * the precise shape it wants on the wire.
 */
export class HttpException extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === 'string' ? body.message : 'Http Exception');
    this.status = status;
    this.body = body;
    this.name = new.target.name;
  }
}

/**
 * The application error envelope: a message, the reason phrase, and the status.
 */
export class MessageException extends HttpException {
  constructor(status: number, error: string, message: string | string[]) {
    super(status, { message, error, statusCode: status });
  }
}

export class BadRequestException extends MessageException {
  constructor(message: string | string[]) {
    super(400, 'Bad Request', message);
  }
}

/**
 * When no message is supplied the envelope collapses to the reason phrase and
 * the status alone -- no `error` key. Supplying a message restores it. Both
 * shapes are reachable from the same class, and both are observable: the
 * authentication guard raises the bare form, the login flow the detailed one.
 */
export class UnauthorizedException extends HttpException {
  constructor(message?: string) {
    super(
      401,
      message === undefined
        ? { message: 'Unauthorized', statusCode: 401 }
        : { message, error: 'Unauthorized', statusCode: 401 },
    );
  }
}

export class ForbiddenException extends MessageException {
  constructor(message: string | string[] = 'Forbidden resource') {
    super(403, 'Forbidden', message);
  }
}

/**
 * Like the unauthorised error, the bare form (no message) carries only the
 * reason phrase and the status.
 */
export class NotFoundException extends HttpException {
  constructor(message?: string | string[]) {
    super(
      404,
      message === undefined
        ? { message: 'Not Found', statusCode: 404 }
        : { message, error: 'Not Found', statusCode: 404 },
    );
  }
}

export class NotAcceptableException extends MessageException {
  constructor(message: string | string[]) {
    super(406, 'Not Acceptable', message);
  }
}

/**
 * Errors raised by the HTTP layer before any handler runs -- unsupported media
 * types, unparseable payloads, rate limiting. These order the status ahead of
 * the message and omit the reason phrase entirely.
 */
export class PlatformException extends HttpException {
  constructor(status: number, message: string) {
    super(status, { statusCode: status, message });
  }
}

/**
 * A payload the body decoder could not accept (empty, malformed, unsafe or too
 * large). The connection is closed after the answer, because the rest of the
 * payload may still be in flight.
 */
export class ContentParserException extends PlatformException {
  readonly closeConnection = true;
}

export class InternalServerErrorException extends PlatformException {
  constructor(message = 'Internal server error') {
    super(500, message);
  }
}
