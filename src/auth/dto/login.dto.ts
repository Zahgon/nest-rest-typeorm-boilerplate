import { IsAlphanumeric, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsAlphanumeric()
  @IsNotEmpty()
  username: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
