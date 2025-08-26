import { Router } from 'express';
import { login, logout, me, signup } from '../components/auth/auth.controller';
import { tryCatch } from '@/infrastructure/middlewares/try-catch';
import { authenticate } from '@/infrastructure/permissions';

export async function authRoutes(mainRouter: Router) {
  const router = Router();

  mainRouter.use('/auth', router);

  router.post('/signup', tryCatch(signup));

  router.post('/login', tryCatch(login));

  router.get('/me', authenticate, tryCatch(me));

  router.post('/logout', tryCatch(logout));
}
