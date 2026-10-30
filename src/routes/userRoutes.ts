import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireIfMatch } from '../middleware/requireHeaders.js';
import {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userIdParamSchema,
} from '../validators/userValidator.js';

export const userRoutes = Router();

// All user administration endpoints require authenticated admin access
userRoutes.use(authenticate);
userRoutes.use(authorize('admin'));

userRoutes.get('/', validate({ query: userQuerySchema }), UserController.getUsers);

userRoutes.post('/', validate({ body: createUserSchema }), UserController.createUser);

userRoutes.get('/:id', validate({ params: userIdParamSchema }), UserController.getUserById);

userRoutes.patch(
  '/:id',
  requireIfMatch,
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  UserController.updateUser
);

userRoutes.post(
  '/:id/reset-password',
  validate({ params: userIdParamSchema }),
  UserController.resetPassword
);

userRoutes.post('/:id/unlock', validate({ params: userIdParamSchema }), UserController.unlockUser);

userRoutes.post(
  '/:id/revoke-sessions',
  validate({ params: userIdParamSchema }),
  UserController.revokeSessions
);

