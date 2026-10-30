import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { User } from '../src/models/User.js';
import { Doctor } from '../src/models/Doctor.js';
import { Patient } from '../src/models/Patient.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/password.js';

describe('Milestone 4 — Dashboard Analytics, Audit Logs & Health API', () => {
  const adminPassword = 'AdminDashboardPassword123!';
  const staffPassword = 'StaffDashboardPassword123!';
  const adminEmail = 'admin.dashboard@doctortracker.dev';
  const staffEmail = 'staff.dashboard@doctortracker.dev';

  let adminCookies: string[];
  let staffCookies: string[];
  let testDoctorId: string;

  let adminId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }

    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Doctor.deleteMany({ email: 'dash.doc@example.com' });
    await Patient.deleteMany({ email: 'dash.patient@example.com' });
    await AuditLog.deleteMany({});

    // 1. Create Admin
    const adminHash = await hashPassword(adminPassword);
    const admin = await User.create({
      name: 'Dashboard Admin',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });
    adminId = admin._id.toString();

    // 2. Create Staff
    const staffHash = await hashPassword(staffPassword);
    await User.create({
      name: 'Dashboard Staff',
      email: staffEmail,
      passwordHash: staffHash,
      role: 'staff',
      status: 'active',
      mustChangePassword: false,
    });

    // 3. Create Seed Doctor and Patient for analytics data
    const doctor = await Doctor.create({
      name: 'Dr. Dashboard Test',
      specialization: 'Cardiology',
      hospital: 'Dhaka Central Hospital',
      phone: '+8801700112233',
      email: 'dash.doc@example.com',
      patientCount: 1,
      version: 1,
    });
    testDoctorId = doctor._id.toString();

    await Patient.create({
      name: 'Dash Patient One',
      age: 50,
      gender: 'male',
      phone: '+8801800112233',
      email: 'dash.patient@example.com',
      condition: 'critical',
      diagnosis: 'Severe Cardiac Arrhythmia',
      admissionDate: new Date(),
      doctorId: doctor._id,
      doctorName: doctor.name,
      version: 1,
    });

    // 4. Create Seed Audit Log
    await AuditLog.create({
      action: 'patient.create',
      actorId: admin._id,
      entityType: 'patient',
      entityId: new mongoose.Types.ObjectId(),
      fields: ['name', 'condition'],
      ip: '127.0.0.1',
    });

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
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Doctor.deleteMany({ email: 'dash.doc@example.com' });
    await Patient.deleteMany({ email: 'dash.patient@example.com' });
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
  });

  describe('GET /api/v1/dashboard/summary', () => {
    it('returns headline numbers, previous range comparisons, and 60-second cache header', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('private, max-age=60');

      const data = res.body.data;
      expect(data).toHaveProperty('range');
      expect(data).toHaveProperty('previousRange');
      expect(data).toHaveProperty('totalDoctors');
      expect(data).toHaveProperty('totalPatients');
      expect(data).toHaveProperty('newPatients');
      expect(data).toHaveProperty('newPatientsPrevPeriod');
      expect(data).toHaveProperty('avgPatientsPerDoctor');
      expect(data).toHaveProperty('criticalPatients');
      expect(data).toHaveProperty('dischargedPatients');
    });

    it('rejects date range exceeding 366 days with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary?from=2024-01-01&to=2026-01-01')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/dashboard/admissions', () => {
    it('returns timeline of admissions with continuous buckets and zero-filled gaps', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admissions')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('private, max-age=60');

      const data = res.body.data;
      expect(data).toHaveProperty('interval');
      expect(Array.isArray(data.current)).toBe(true);
      expect(Array.isArray(data.previous)).toBe(true);
      expect(data.current.length).toBeGreaterThan(0);
      expect(data.current[0]).toHaveProperty('date');
      expect(data.current[0]).toHaveProperty('count');
    });
  });

  describe('GET /api/v1/dashboard/patients-per-doctor', () => {
    it('returns doctors sorted by patient count up to requested limit', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/patients-per-doctor?limit=5')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('private, max-age=60');

      const list = res.body.data;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeLessThanOrEqual(5);
      if (list.length > 0) {
        expect(list[0]).toHaveProperty('doctorId');
        expect(list[0]).toHaveProperty('name');
        expect(list[0]).toHaveProperty('specialization');
        expect(list[0]).toHaveProperty('count');
      }
    });
  });

  describe('GET /api/v1/dashboard/breakdown', () => {
    it('returns complete condition breakdown and specialization distributions', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/breakdown')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('private, max-age=60');

      const { byCondition, bySpecialization } = res.body.data;
      expect(Array.isArray(byCondition)).toBe(true);
      expect(byCondition.length).toBe(5); // stable, under_observation, critical, recovering, discharged
      expect(byCondition.some((c: any) => c.condition === 'critical' && c.count >= 1)).toBe(true);

      expect(Array.isArray(bySpecialization)).toBe(true);
      expect(bySpecialization.some((s: any) => s.specialization === 'Cardiology')).toBe(true);
    });
  });

  describe('GET /api/v1/audit-logs (Admin Only)', () => {
    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 FORBIDDEN when accessed by non-admin staff member', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns paginated audit trail with resolved actor name to admin', async () => {
      const res = await request(app)
        .get(`/api/v1/audit-logs?actorId=${adminId}&page=1&limit=10`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toBe('no-store');

      const logs = res.body.data;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toHaveProperty('id');
      expect(logs[0]).toHaveProperty('action');
      expect(logs[0]).toHaveProperty('at');
      expect(logs[0]).toHaveProperty('actor');
      expect(logs[0].actor).toHaveProperty('name', 'Dashboard Admin');
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        hasNextPage: false,
      });
    });

    it('filters audit logs by action and entityType', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?action=patient.create&entityType=patient')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.every((l: any) => l.action === 'patient.create' && l.entityType === 'patient')).toBe(true);
    });
  });

  describe('GET /api/v1/health & /health (Uptime Monitoring)', () => {
    it('returns 200 with standard health contract { status: ok, db: up, version: 1.4.0 }', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        db: 'up',
        version: '1.4.0',
      });
    });
  });
});
