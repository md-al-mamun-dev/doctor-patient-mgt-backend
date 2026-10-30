import type { Request, Response } from 'express';
import { UserService } from '../services/userService.js';
import { sendSuccess } from '../utils/response.js';
import {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userIdParamSchema,
} from '../validators/userValidator.js';

export class UserController {
  static async getUsers(req: Request, res: Response): Promise<void> {
    const query = userQuerySchema.parse(req.query);
    const result = await UserService.getUsers(query);

    sendSuccess(res, {
      statusCode: 200,
      data: result.users,
      meta: result.meta,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async createUser(req: Request, res: Response): Promise<void> {
    const input = createUserSchema.parse(req.body);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await UserService.createUser(input, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 201,
      data: {
        user: result.user,
        temporaryPassword: result.temporaryPassword,
      },
      headers: {
        Location: `/api/v1/users/${result.user.id}`,
        ETag: `"${result.user.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await UserService.getUserById(id);

    sendSuccess(res, {
      statusCode: 200,
      data: user,
      headers: {
        ETag: `"${user.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const expectedVersion = (req as any).expectedVersion;
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const updatedUser = await UserService.updateUser(
      id,
      input,
      expectedVersion,
      actorId,
      ip,
      userAgent
    );

    sendSuccess(res, {
      statusCode: 200,
      data: updatedUser,
      headers: {
        ETag: `"${updatedUser.version}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { id } = userIdParamSchema.parse(req.params);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await UserService.resetPassword(id, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 200,
      data: {
        temporaryPassword: result.temporaryPassword,
      },
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  static async unlockUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdParamSchema.parse(req.params);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    await UserService.unlockUser(id, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 204,
    });
  }

  static async revokeSessions(req: Request, res: Response): Promise<void> {
    const { id } = userIdParamSchema.parse(req.params);
    const actorId = req.user.id;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    await UserService.revokeSessions(id, actorId, ip, userAgent);

    sendSuccess(res, {
      statusCode: 204,
    });
  }
}

