import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      sendSuccess(res, {
        statusCode: 201,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      sendSuccess(res, {
        statusCode: 200,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    sendSuccess(res, {
      statusCode: 200,
      message: 'Logged out successfully',
    });
  }

  static async getMe(req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      statusCode: 200,
      message: 'Current user profile',
      data: req.user,
    });
  }
}

