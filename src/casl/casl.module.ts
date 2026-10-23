import { CaslFactory } from './casl.factory';

/**
 * Owns the ability factory that turns a user into the set of actions they are
 * allowed to perform.
 */
export class CaslModule {
  readonly factory: CaslFactory;

  constructor() {
    this.factory = new CaslFactory();
  }
}
