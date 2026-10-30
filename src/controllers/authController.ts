import type { Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';
import {
  setAuthCookies,
  clearAuthCookies,
  extractRefreshToken,
} from '../utils/token.js';
import type { LoginInput, ChangePasswordInput, RegisterInput } from '../validators/authValidator.js';

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const input = req.body as LoginInput;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.login(input, ip, userAgent);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.session.expiresAt);

    sendSuccess(res, {
      statusCode: 200,
      data: {
        user: result.user,
        session: result.session,
      },
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = extractRefreshToken(req);
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.refresh(rawRefreshToken || '', ip, userAgent);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.session.expiresAt);

    sendSuccess(res, {
      statusCode: 200,
      data: {
        session: result.session,
      },
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = extractRefreshToken(req);
    await AuthService.logout(rawRefreshToken);
    clearAuthCookies(res, true);

    sendSuccess(res, {
      statusCode: 204,
    });
  }

  static async logoutAll(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    await AuthService.logoutAll(userId);
    clearAuthCookies(res, true);

    sendSuccess(res, {
      statusCode: 204,
    });
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const sid = (req as any).user.sid;

    const result = await AuthService.getMe(userId, sid);

    sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const input = req.body as ChangePasswordInput;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.changePassword(userId, input, ip, userAgent);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.session.expiresAt);

    sendSuccess(res, {
      statusCode: 200,
      data: {
        user: result.user,
      },
    });
  }

  // Legacy register endpoint support
  static async register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;
    const result = await AuthService.register(input);

    sendSuccess(res, {
      statusCode: 201,
      data: result,
    });
  }
}
