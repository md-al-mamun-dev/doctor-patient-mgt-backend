import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';

export const authRoutes = Router();

authRoutes.post('/register', validate({ body: registerSchema }), AuthController.register);
authRoutes.post('/login', validate({ body: loginSchema }), AuthController.login);
authRoutes.post('/logout', AuthController.logout);
authRoutes.get('/me', authenticate, AuthController.getMe);

