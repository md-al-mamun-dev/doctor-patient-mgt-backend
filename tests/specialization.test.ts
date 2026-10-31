import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Specialization } from '../src/models/Specialization.js';
import { hashPassword } from '../src/utils/password.js';

describe('Specialization Endpoints: GET and POST /api/v1/specializations', () => {
  const adminPassword = 'AdminSpecPass123!';
  const staffPassword = 'StaffSpecPass123!';
  const adminEmail = 'admin.spec@doctortracker.dev';
  const staffEmail = 'staff.spec@doctortracker.dev';

  let adminCookies: string[];
  let staffCookies: string[];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }

    // Clean test state
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Specialization.deleteMany({ name: { $in: ['Pediatric Neuro-Oncology', 'Integrative Medicine'] } });

    // Ensure at least one known specialization exists
    await Specialization.findOneAndUpdate(
      { name: 'Cardiology' },
      { name: 'Cardiology' },
      { upsert: true, returnDocument: 'after' }
    );

    // 1. Create Admin
    const adminHash = await hashPassword(adminPassword);
    await User.create({
      name: 'Specialization Admin',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });

    // 2. Create Staff
    const staffHash = await hashPassword(staffPassword);
    await User.create({
      name: 'Specialization Staff',
      email: staffEmail,
      passwordHash: staffHash,
      role: 'staff',
      status: 'active',
      mustChangePassword: false,
    });

    // Login Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminCookies = adminLoginRes.headers['set-cookie'] as unknown as string[];

    // Login Staff
    const staffLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: staffPassword });
    staffCookies = staffLoginRes.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Specialization.deleteMany({ name: { $in: ['Pediatric Neuro-Oncology', 'Integrative Medicine'] } });
    await mongoose.disconnect();
  });

  describe('GET /api/v1/specializations', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/specializations');
      expect(res.status).toBe(401);
    });

    it('allows authenticated staff to fetch specializations list', async () => {
      const res = await request(app)
        .get('/api/v1/specializations')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const cardio = res.body.data.find((s: { name: string }) => s.name === 'Cardiology');
      expect(cardio).toBeDefined();
      expect(cardio.id).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('filters specializations by query parameter ?q=', async () => {
      const res = await request(app)
        .get('/api/v1/specializations?q=cardio')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((s: { name: string }) => s.name.toLowerCase().includes('cardio'))).toBe(true);
    });
  });

  describe('POST /api/v1/specializations', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/specializations')
        .send({ name: 'Pediatric Neuro-Oncology' });

      expect(res.status).toBe(401);
    });

    it('rejects staff user with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/specializations')
        .set('Cookie', staffCookies)
        .send({ name: 'Pediatric Neuro-Oncology' });

      expect(res.status).toBe(403);
    });

    it('validates specialization name length (min 2 chars)', async () => {
      const res = await request(app)
        .post('/api/v1/specializations')
        .set('Cookie', adminCookies)
        .send({ name: 'S' });

      expect(res.status).toBe(400);
    });

    it('allows admin to create a new specialization with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/specializations')
        .set('Cookie', adminCookies)
        .send({ name: 'Pediatric Neuro-Oncology' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Pediatric Neuro-Oncology');
      expect(res.body.data.id).toBeDefined();
    });

    it('handles idempotent duplicate creation by returning existing record with 200 OK', async () => {
      const res = await request(app)
        .post('/api/v1/specializations')
        .set('Cookie', adminCookies)
        .send({ name: 'pediatric neuro-oncology' }); // Case-insensitive duplicate

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Pediatric Neuro-Oncology');
    });
  });
});

