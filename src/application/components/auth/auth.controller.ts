import { Request, Response } from 'express';
import { loginSchema, signupSchema } from './auth.schemas';
import { AuthService } from './auth.service';
import { ResponseHandler } from '@/infrastructure/handlers/response.handler';
import { HttpStatusCode } from '@/infrastructure/utils/constants';

const tokenExpirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
const secureCookie = process.env.NODE_ENV === 'production';

const authService = new AuthService();

export const signup = async (req: Request, res: Response) => {
  const data = signupSchema.parse(req.body);

  const { user, token } = await authService.signup(data);

  res.cookie('jwt', token, { expires: tokenExpirationDate, httpOnly: true, secure: secureCookie });
  return ResponseHandler.success(res, { user }, HttpStatusCode.CREATED);
};

export const login = async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  const { user, token } = await authService.login(data);

  res.cookie('jwt', token, { expires: tokenExpirationDate, httpOnly: true, secure: secureCookie });
  return ResponseHandler.success(res, { user }, HttpStatusCode.OK);
};

export const me = async (req: Request, res: Response) => {
  const { email } = req.body.user;

  const user = await authService.me(email);

  return ResponseHandler.success(res, { user }, HttpStatusCode.OK);
};

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie('jwt');
  return ResponseHandler.success(res, null, HttpStatusCode.OK);
}
