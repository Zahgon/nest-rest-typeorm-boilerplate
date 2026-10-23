import { IJWTResponseBody } from '../shared/api-types';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async login(payload: LoginDto): Promise<IJWTResponseBody> {
    const user = await this.authService.validateUser(payload);
    return this.authService.createToken(user);
  }

  async register(payload: RegisterDto): Promise<IJWTResponseBody> {
    const user = await this.usersService.create(payload);
    return this.authService.createToken(user);
  }
}
