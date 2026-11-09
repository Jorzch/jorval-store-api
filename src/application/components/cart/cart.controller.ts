import { Request, Response } from 'express';
import { CartService } from './cart.service';
import { ResponseHandler } from '@/infrastructure/handlers/response.handler';
import { HttpStatusCode } from '@/infrastructure/utils/constants';
import { addOrRemoveProductToCartSchema } from './cart.schemas';

const cartService = new CartService();

export const getCart = async (req: Request, res: Response) => {
  const { email } = req.body.user;

  const cart = await cartService.getByUserEmail(email);

  return ResponseHandler.success(res, cart.toSafeObject, HttpStatusCode.OK);
};

export const addProductToCart = async (req: Request, res: Response) => {
  const { email } = req.body.user;
  const { productSlug, quantity } = addOrRemoveProductToCartSchema.parse(req.body);

  await cartService.addProduct(email, productSlug, quantity);

  return ResponseHandler.success(res, null, HttpStatusCode.OK);
};

export const removeProductFromCart = async (req: Request, res: Response) => {
  const { email } = req.body.user;
  const { productSlug, quantity } = addOrRemoveProductToCartSchema.parse(req.body);

  await cartService.removeProduct(email, productSlug, quantity);

  return ResponseHandler.success(res, null, HttpStatusCode.OK);
};

export const checkout = async (req: Request, res: Response) => {
  const { email } = req.body.user;

  const order = await cartService.checkout(email);

  return ResponseHandler.success(res, order.toSafeObject, HttpStatusCode.OK);
};
