import {
  IsAlphanumeric,
  IsEmail,
  IsNotEmpty,
  Matches,
  MinLength,
} from 'class-validator';

export class PatchUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsAlphanumeric()
  @IsNotEmpty()
  username: string;

  @Matches(/^[a-zA-Z ]+$/)
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
