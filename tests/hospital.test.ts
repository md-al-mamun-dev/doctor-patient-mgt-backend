import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Hospital } from '../src/models/Hospital.js';
import { hashPassword } from '../src/utils/password.js';

describe('Hospital Endpoints: GET and POST /api/v1/hospitals', () => {
  const adminPassword = 'AdminHospitalPass123!';
  const staffPassword = 'StaffHospitalPass123!';
  const adminEmail = 'admin.hospital@doctortracker.dev';
  const staffEmail = 'staff.hospital@doctortracker.dev';

  let adminCookies: string[];
  let staffCookies: string[];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }

    // Clean test state
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Hospital.deleteMany({ name: { $in: ['Test Memorial Hospital', 'Specialized Care Center'] } });

    // Ensure at least one known hospital exists
    await Hospital.findOneAndUpdate(
      { name: 'Square Hospital' },
      { name: 'Square Hospital' },
      { upsert: true, returnDocument: 'after' }
    );

    // 1. Create Admin
    const adminHash = await hashPassword(adminPassword);
    await User.create({
      name: 'Hospital Admin',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });

    // 2. Create Staff
    const staffHash = await hashPassword(staffPassword);
    await User.create({
      name: 'Hospital Staff',
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
    await Hospital.deleteMany({ name: { $in: ['Test Memorial Hospital', 'Specialized Care Center'] } });
    await mongoose.disconnect();
  });

  describe('GET /api/v1/hospitals', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/hospitals');
      expect(res.status).toBe(401);
    });

    it('allows authenticated staff to fetch hospitals list', async () => {
      const res = await request(app)
        .get('/api/v1/hospitals')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const squareDoc = res.body.data.find((h: { name: string }) => h.name === 'Square Hospital');
      expect(squareDoc).toBeDefined();
      expect(squareDoc.id).toBeDefined();
    });

    it('filters hospitals by query parameter ?q=', async () => {
      const res = await request(app)
        .get('/api/v1/hospitals?q=Square')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((h: { name: string }) => h.name.includes('Square'))).toBe(true);
    });
  });

  describe('POST /api/v1/hospitals', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/hospitals')
        .send({ name: 'Test Memorial Hospital' });

      expect(res.status).toBe(401);
    });

    it('rejects staff user with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/hospitals')
        .set('Cookie', staffCookies)
        .send({ name: 'Test Memorial Hospital' });

      expect(res.status).toBe(403);
    });

    it('validates hospital name length (min 2 chars)', async () => {
      const res = await request(app)
        .post('/api/v1/hospitals')
        .set('Cookie', adminCookies)
        .send({ name: 'H' });

      expect(res.status).toBe(400);
    });

    it('allows admin to create a new hospital with 201 Created', async () => {
      const res = await request(app)
        .post('/api/v1/hospitals')
        .set('Cookie', adminCookies)
        .send({ name: 'Test Memorial Hospital' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Memorial Hospital');
      expect(res.body.data.id).toBeDefined();
    });

    it('returns 200 with existing hospital when name matches (case-insensitive)', async () => {
      const res = await request(app)
        .post('/api/v1/hospitals')
        .set('Cookie', adminCookies)
        .send({ name: 'test memorial hospital' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Memorial Hospital');
    });
  });
});

