import { LoginSchema, SignupSchema } from './auth.schemas';
import { Jwt } from '@/infrastructure/utils/jwt';
import { CustomError } from '@/domain/errors/custom.error';
import { UserFactory } from '@/infrastructure/factories/user.factory';
import { CartService } from '../cart/cart.service';
import { UserService } from '../users/user.service';

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async signup(data: SignupSchema) {
    const user = await this.userService.getByEmail(data.email);
    if (user) {
      throw CustomError.badRequest('User already exists');
    }

    const newUser = UserFactory.createFromMinimalInputs(data);
    newUser.hashPassword();

    const userCreated = await this.userService.create(newUser);

    const cartService = new CartService();
    await cartService.create(userCreated);

    const token = Jwt.generateToken(userCreated.toSafeObject, '1d');

    return { user: userCreated.toSafeObject, token };
  }

  async login(data: LoginSchema) {
    const user = await this.userService.getByEmail(data.email);
    if (!user) {
      throw CustomError.notFound('User not found');
    }

    const isValidPassword = user.isValidPassword(data.password);
    if (!isValidPassword) {
      throw CustomError.unauthorized('Invalid credentials');
    }

    const token = Jwt.generateToken(user.toSafeObject, '1d');

    return { user: user.toSafeObject, token };
  }

  async me(email: string) {
    const user = await this.userService.getByEmail(email);
    if (!user) {
      throw CustomError.notFound('User not found');
    }

    return user.toSafeObject;
  }
}
