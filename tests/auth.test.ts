import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/password.js';

describe('Milestone 1 — Authentication & Security API', () => {
  const testUserPassword = 'correct horse battery staple 123';
  let testUserId: string;
  const testUserEmail = 'nadia.islam@doctortracker.dev';

  beforeAll(async () => {
    await mongoose.connect(config.MONGODB_URI);
    await User.deleteMany({ email: testUserEmail });
    await RefreshToken.deleteMany({});
    await AuditLog.deleteMany({});

    const passwordHash = await hashPassword(testUserPassword);
    const user = await User.create({
      name: 'Nadia Islam',
      email: testUserEmail,
      passwordHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });
    testUserId = user._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: testUserEmail });
    await RefreshToken.deleteMany({});
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 VALIDATION_ERROR on malformed email or missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.requestId).toBeDefined();
      expect(res.body.error.details).toBeInstanceOf(Array);
    });

    it('returns 401 INVALID_CREDENTIALS for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost.user@doctortracker.dev', password: 'password12345678' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Email or password is incorrect.');
    });

    it('returns 401 INVALID_CREDENTIALS for incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: 'wrongpassword12345' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Email or password is incorrect.');
    });

    it('returns 200 with user, session, cookies, and X-Request-Id on valid sign-in', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.body.data.user.id).toBe(testUserId);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.session).toHaveProperty('startedAt');
      expect(res.body.data.session).toHaveProperty('expiresAt');

      // Check cookies
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies.join(';');
      expect(cookieStr).toMatch(/dt_access/);
      expect(cookieStr).toMatch(/dt_refresh/);
      expect(cookieStr).toMatch(/dt_session/);
    });
  });

  describe('Session Lifecycle: Refresh, Me, and Logout', () => {
    let authCookies: string[];

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });
      authCookies = loginRes.headers['set-cookie'] || [];
    });

    it('GET /api/v1/auth/me returns current authenticated user details', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUserEmail);
      expect(res.body.data.session).toBeDefined();
    });

    it('POST /api/v1/auth/refresh rotates the refresh token and returns new session', async () => {
      const refreshCookie = authCookies.find((c) => c.includes('dt_refresh'));
      expect(refreshCookie).toBeDefined();

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie!]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toHaveProperty('expiresAt');

      // Update cookies for subsequent tests
      const newCookies = res.headers['set-cookie'];
      expect(newCookies).toBeDefined();

      // Test Reuse Detection: Re-using the same old refresh cookie must fail and revoke family
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie!]);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('UNAUTHORIZED');
      expect(reuseRes.body.error.message).toMatch(/reuse detected/i);
    });

    it('POST /api/v1/auth/logout ends the session and returns 204', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });
      const currentCookies = loginRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', currentCookies);

      expect(res.status).toBe(204);
      expect(res.headers['clear-site-data']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let authCookies: string[];

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: testUserPassword });
      authCookies = loginRes.headers['set-cookie'] || [];
    });

    it('returns 400 VALIDATION_ERROR with path currentPassword when current password is wrong', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookies)
        .send({
          currentPassword: 'thisisnotthecurrentpassword',
          newPassword: 'brandnewpassword12345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].path).toBe('currentPassword');
    });

    it('returns 400 VALIDATION_ERROR if new password is under 15 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookies)
        .send({
          currentPassword: testUserPassword,
          newPassword: 'shortpassword',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].path).toBe('newPassword');
    });

    it('successfully changes password and updates session tokens', async () => {
      const newPass = 'averysecurenewpassword12345';
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', authCookies)
        .send({
          currentPassword: testUserPassword,
          newPassword: newPass,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify sign-in works with the newly updated password
      const reLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: newPass });

      expect(reLogin.status).toBe(200);
    });
  });
});

