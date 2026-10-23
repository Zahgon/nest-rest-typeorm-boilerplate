import { CaslFactory } from './casl.factory';
import { createPoliciesGuard } from './policies.guard';
import { DeleteUserPolicyHandler } from './policy-handlers';

describe('PoliciesGuard', () => {
  it('should be defined', () => {
    const caslFactory = new CaslFactory();
    expect(
      createPoliciesGuard(caslFactory, new DeleteUserPolicyHandler()),
    ).toBeDefined();
  });
});
