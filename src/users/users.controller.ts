import { BadRequestException } from '../common/http-exception';
import { IGenericMessageBody } from '../shared/api-types';
import { PatchUserDto } from './dto/patch-user.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getUser(user: User): User {
    return user;
  }

  async getUserByUsername(username: string): Promise<User> {
    const user = await this.usersService.getByUsername(username);
    if (!user) {
      throw new BadRequestException(
        'The user with that username could not be found.',
      );
    }
    return user;
  }

  async patchUser(payload: PatchUserDto): Promise<User> {
    return this.usersService.edit(payload);
  }

  async deleteUserByUsername(username: string): Promise<IGenericMessageBody> {
    return this.usersService.delete(username);
  }
}
