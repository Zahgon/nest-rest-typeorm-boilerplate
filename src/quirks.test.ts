import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import * as crypto from 'crypto';
import { getMetadataArgsStorage } from 'typeorm';

import { flattenValidationErrors } from './common/validation.middleware';
import { swaggerDocument } from './common/swagger-document';
import { AuthService } from './auth/auth.service';
import { RegisterDto } from './auth/dto/register.dto';
import { PatchUserDto } from './users/dto/patch-user.dto';
import { PasswordTransformer } from './users/password.transformer';
import { UserRolesEnum } from './shared/api-types';

import './users/user-role.entity';
import './users/user.entity';

/**
 * Behaviour that is surprising, wrong, or both, and is kept anyway. Each case
 * exists so that anybody who "fixes" one has to decide to delete a test first.
 */
describe('inherited behaviour', () => {
  it('hashes a password by keying the digest with it rather than digesting it', () => {
    const transformer = new PasswordTransformer();

    expect(transformer.to('correct horse')).toBe(
      crypto.createHmac('sha256', 'correct horse').digest('hex'),
    );
    expect(transformer.to('correct horse')).not.toBe(
      crypto.createHash('sha256').update('correct horse').digest('hex'),
    );
  });

  it('reads a stored password back unchanged', () => {
    expect(new PasswordTransformer().from('stored')).toBe('stored');
  });

  it('grants every newly created account the highest role', () => {
    const column = getMetadataArgsStorage().columns.find(
      (candidate) =>
        candidate.target === require('./users/user-role.entity').UserRoles &&
        candidate.propertyName === 'role',
    );

    expect(column?.options.default).toBe(UserRolesEnum.SUDO);
  });

  it('keeps the password out of query results by default', () => {
    const column = getMetadataArgsStorage().columns.find(
      (candidate) =>
        candidate.target === require('./users/user.entity').User &&
        candidate.propertyName === 'password',
    );

    expect(column?.options.select).toBe(false);
  });

  it('requires every field on the partial update payload', () => {
    const errors = validateSync(plainToInstance(PatchUserDto, {}), {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    expect(flattenValidationErrors(errors)).toEqual([
      'email should not be empty',
      'email must be an email',
      'username should not be empty',
      'username must contain only letters and numbers',
      'name should not be empty',
      'name must match /^[a-zA-Z ]+$/ regular expression',
      'password must be longer than or equal to 8 characters',
      'password should not be empty',
    ]);
  });

  it('refuses a name that is not plain unaccented latin', () => {
    const errors = validateSync(
      plainToInstance(RegisterDto, {
        email: 'renee@example.com',
        username: 'renee',
        name: 'Renée Nakamura',
        password: 'longenoughpassword',
      }),
      { whitelist: true, forbidNonWhitelisted: false },
    );

    expect(flattenValidationErrors(errors)).toEqual([
      'name must match /^[a-zA-Z ]+$/ regular expression',
    ]);
  });

  it('leaves the credential check misspelled in the inherited controller test', () => {
    expect(typeof AuthService.prototype.validateUser).toBe('function');
    expect(
      (AuthService.prototype as unknown as Record<string, unknown>).valideUser,
    ).toBeUndefined();
  });

  it('answers a successful login as created rather than as ok', () => {
    const login = swaggerDocument.paths['/api/v1/auth/login'].post;

    expect(Object.keys(login.responses)).toContain('201');
    expect(Object.keys(login.responses)).not.toContain('200');
  });
});
