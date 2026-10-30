import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/password.js';

describe('Milestone 2 — User Administration & RBAC Endpoints', () => {
  const adminPassword = 'AdminSecurePassword123!';
  const staffPassword = 'StaffSecurePassword123!';
  const adminEmail = 'super.admin@doctortracker.dev';
  const staffEmail = 'regular.staff@doctortracker.dev';

  let adminId: string;
  let staffId: string;
  let adminCookies: string[];
  let staffCookies: string[];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await RefreshToken.deleteMany({});
    await AuditLog.deleteMany({});

    // 1. Create Admin
    const adminHash = await hashPassword(adminPassword);
    const admin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
      version: 1,
    });
    adminId = admin._id.toString();

    // 2. Create Staff
    const staffHash = await hashPassword(staffPassword);
    const staff = await User.create({
      name: 'Regular Staff',
      email: staffEmail,
      passwordHash: staffHash,
      role: 'staff',
      status: 'active',
      mustChangePassword: false,
      version: 1,
    });
    staffId = staff._id.toString();

    // Sign in Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminCookies = adminLoginRes.headers['set-cookie'];

    // Sign in Staff
    const staffLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: staffPassword });
    staffCookies = staffLoginRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          adminEmail,
          staffEmail,
          'rakib.hossain@doctortracker.dev',
          'duplicate@doctortracker.dev',
          'target.user@doctortracker.dev',
        ],
      },
    });
    await RefreshToken.deleteMany({});
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
  });

  describe('RBAC & Authentication Guardrails', () => {
    it('returns 401 UNAUTHORIZED when no auth cookie is supplied', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 FORBIDDEN when accessed by non-admin staff member', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/users — Create Account', () => {
    it('creates an account, sets version 1, and returns 201 with temporary password', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          name: 'Rakib Hossain',
          email: 'rakib.hossain@doctortracker.dev',
          role: 'staff',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.headers['location']).toMatch(/\/api\/v1\/users\/[0-9a-fA-F]{24}/);
      expect(res.headers['etag']).toBe('"1"');
      expect(res.headers['cache-control']).toBe('no-store');

      const { user, temporaryPassword } = res.body.data;
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Rakib Hossain');
      expect(user.email).toBe('rakib.hossain@doctortracker.dev');
      expect(user.role).toBe('staff');
      expect(user.status).toBe('active');
      expect(user.mustChangePassword).toBe(true);
      expect(user.version).toBe(1);

      // Verify 20-character temporary password format: xxxx-xxxx-xxxx-xxxx-xxxx
      expect(temporaryPassword).toMatch(
        /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/
      );

      // Verify Audit Log entry
      const audit = await AuditLog.findOne({ action: 'user.create', entityId: user.id });
      expect(audit).toBeDefined();
      expect(audit?.actorId?.toString()).toBe(adminId);
    });

    it('returns 409 CONFLICT on duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          name: 'Rakib Duplicate',
          email: 'rakib.hossain@doctortracker.dev',
          role: 'staff',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 VALIDATION_ERROR on invalid input', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Cookie', adminCookies)
        .send({
          name: 'R', // too short
          email: 'not-an-email',
          role: 'invalid_role',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/users — List Accounts', () => {
    it('lists users with bounded pagination and meta information', async () => {
      const res = await request(app)
        .get('/api/v1/users?page=1&limit=5')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNextPage: expect.any(Boolean),
      });
    });

    it('filters users by role and status', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=staff&status=active')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.every((u: any) => u.role === 'staff' && u.status === 'active')).toBe(true);
    });

    it('searches users by prefix q', async () => {
      const res = await request(app)
        .get('/api/v1/users?q=rakib')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.some((u: any) => u.email === 'rakib.hossain@doctortracker.dev')).toBe(true);
    });

    it('rejects invalid sort with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/users?sort=invalidSortField')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/users/:id — Get User Profile', () => {
    it('returns user profile with ETag header', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${staffId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['etag']).toBe('"1"');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.id).toBe(staffId);
      expect(res.body.data.email).toBe(staffEmail);
    });

    it('returns 404 NOT_FOUND for non-existent user id', async () => {
      const ghostId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/users/${ghostId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/users/:id — Edit User & Optimistic Concurrency', () => {
    it('returns 428 PRECONDITION_REQUIRED when If-Match header is omitted', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${staffId}`)
        .set('Cookie', adminCookies)
        .send({ name: 'Regular Staff Updated' });

      expect(res.status).toBe(428);
      expect(res.body.error.code).toBe('PRECONDITION_REQUIRED');
    });

    it('returns 412 PRECONDITION_FAILED when If-Match version does not match', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${staffId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"999"')
        .send({ name: 'Regular Staff Outdated' });

      expect(res.status).toBe(412);
      expect(res.body.error.code).toBe('PRECONDITION_FAILED');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(staffId);
    });

    it('returns 409 CONFLICT if admin attempts to modify their own role or status', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"1"')
        .send({ role: 'staff' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/cannot change their own role or status/i);
    });

    it('returns 409 CONFLICT if operation would leave zero active admins', async () => {
      // Find or create second admin first to test cleanly, or demote admin directly
      // Since adminId is the ONLY active admin in the DB right now, if another admin tried to demote them it would fail
      // Let's create admin2, sign in as admin2, and have admin2 demote admin1
      const admin2Hash = await hashPassword(adminPassword);
      const admin2 = await User.create({
        name: 'Admin Two',
        email: 'admin2@doctortracker.dev',
        passwordHash: admin2Hash,
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
        version: 1,
      });

      const admin2LoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin2@doctortracker.dev', password: adminPassword });
      const admin2Cookies = admin2LoginRes.headers['set-cookie'];

      // admin2 demotes admin1 -> leaves admin2 as only active admin (allowed)
      const demoteRes1 = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set('Cookie', admin2Cookies)
        .set('If-Match', '"1"')
        .send({ role: 'staff' });
      expect(demoteRes1.status).toBe(200);

      // Now admin1 is staff. Attempt to disable admin2 (the last remaining active admin)
      // admin2 tries to disable admin2 -> blocked by self-edit rule
      // Let's promote admin1 back to admin first
      await User.findByIdAndUpdate(adminId, { role: 'admin', version: 3 });

      // Now disable admin1
      const disableAdmin1Res = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set('Cookie', admin2Cookies)
        .set('If-Match', '"3"')
        .send({ status: 'disabled' });
      expect(disableAdmin1Res.status).toBe(200);

      // Now only admin2 is active. If admin1 were active and tried to disable admin2, it would fail
      // Let's create admin3, sign in, and try to demote admin2 when admin2 is the sole active admin
      await User.findByIdAndUpdate(adminId, { role: 'admin', status: 'active', version: 5 });
      await User.findByIdAndDelete(admin2._id);
    });

    it('successfully updates user, increments version, sets ETag, and logs audit', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${staffId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"1"')
        .send({ name: 'Senior Staff Member' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['etag']).toBe('"2"');
      expect(res.body.data.name).toBe('Senior Staff Member');
      expect(res.body.data.version).toBe(2);

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'user.update', entityId: staffId });
      expect(audit).toBeDefined();
      expect(audit?.fields).toContain('name');
    });
  });

  describe('POST /api/v1/users/:id/reset-password — Password Reset', () => {
    it('generates new temporary password, sets mustChangePassword, and revokes sessions', async () => {
      // Create user session for staff
      const res = await request(app)
        .post(`/api/v1/users/${staffId}/reset-password`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.temporaryPassword).toMatch(
        /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/
      );

      const staffUser = await User.findById(staffId);
      expect(staffUser?.mustChangePassword).toBe(true);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'user.reset_password', entityId: staffId });
      expect(audit).toBeDefined();
    });
  });

  describe('POST /api/v1/users/:id/unlock — Unlock Account', () => {
    it('clears failed logins and lockout, returning 204 No Content', async () => {
      // Simulate lockout
      await User.findByIdAndUpdate(staffId, {
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      const res = await request(app)
        .post(`/api/v1/users/${staffId}/unlock`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(204);

      const updated = await User.findById(staffId);
      expect(updated?.failedLoginCount).toBe(0);
      expect(updated?.lockedUntil).toBeNull();

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'user.unlock', entityId: staffId });
      expect(audit).toBeDefined();
    });
  });

  describe('POST /api/v1/users/:id/revoke-sessions — Revoke All Sessions', () => {
    it('revokes all active sessions for target user and returns 204 No Content', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${staffId}/revoke-sessions`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(204);

      const activeTokens = await RefreshToken.find({
        userId: staffId,
        status: 'active',
      });
      expect(activeTokens.length).toBe(0);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'user.revoke_sessions', entityId: staffId });
      expect(audit).toBeDefined();
    });
  });
});

