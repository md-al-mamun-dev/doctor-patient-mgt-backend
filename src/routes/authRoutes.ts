import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter.js';
import {
  loginSchema,
  changePasswordSchema,
} from '../validators/authValidator.js';

export const authRoutes = Router();

authRoutes.post('/login', loginRateLimiter, validate({ body: loginSchema }), AuthController.login);
authRoutes.post('/refresh', refreshRateLimiter, AuthController.refresh);
authRoutes.post('/logout', authenticate, AuthController.logout);
authRoutes.post('/logout-all', authenticate, AuthController.logoutAll);
authRoutes.get('/me', authenticate, AuthController.getMe);
authRoutes.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  AuthController.changePassword
);
