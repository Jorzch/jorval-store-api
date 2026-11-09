import { CartItem } from './cart-item.entity';
import { iEntity } from './iEntity';
import { User } from './user.entity';

export class Cart extends iEntity {
  private id: string;
  private User: User;
  private CartItems: CartItem[];

  constructor(data: { id: string; User: User; CartItems: CartItem[] }) {
    super();
    this.id = data.id;
    this.User = data.User;
    this.CartItems = data.CartItems;
  }

  get toSafeObject() {
    return {
      id: this.id,
      CartItems: this.CartItems.map((item) => item.toSafeObject),
    };
  }

  getUser() {
    return this.User.toSafeObject;
  }
}
