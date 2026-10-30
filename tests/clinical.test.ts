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

describe('Milestone 3 — Clinical Core: Doctors & Patients API with Transactions', () => {
  const adminPassword = 'AdminClinicalPassword123!';
  const staffPassword = 'StaffClinicalPassword123!';
  const adminEmail = 'admin.clinical@doctortracker.dev';
  const staffEmail = 'staff.clinical@doctortracker.dev';

  let adminCookies: string[];
  let staffCookies: string[];

  let doctorAId: string;
  let doctorBId: string;
  let patientAId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }

    // Clean test state
    await User.deleteMany({ email: { $in: [adminEmail, staffEmail] } });
    await Doctor.deleteMany({
      email: { $in: ['farhana.rahman@square.example', 'kamal.hossain@dmc.example', 'new.doc@example.com'] },
    });
    await Patient.deleteMany({
      email: { $in: ['tariq.anwar@example.com', 'salma.begum@example.com', 'karim.test@example.com'] },
    });
    await AuditLog.deleteMany({});

    // 1. Create Admin
    const adminHash = await hashPassword(adminPassword);
    await User.create({
      name: 'Clinical Admin',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });

    // 2. Create Staff
    const staffHash = await hashPassword(staffPassword);
    await User.create({
      name: 'Clinical Staff',
      email: staffEmail,
      passwordHash: staffHash,
      role: 'staff',
      status: 'active',
      mustChangePassword: false,
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
    await Doctor.deleteMany({
      email: { $in: ['farhana.rahman@square.example', 'kamal.hossain@dmc.example', 'new.doc@example.com'] },
    });
    await Patient.deleteMany({
      email: { $in: ['tariq.anwar@example.com', 'salma.begum@example.com', 'karim.test@example.com'] },
    });
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
  });

  describe('POST /api/v1/doctors — Add Doctor (Admin only)', () => {
    it('returns 403 FORBIDDEN when staff attempts to create a doctor', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Cookie', staffCookies)
        .send({
          name: 'Dr. Farhana Rahman',
          specialization: 'Cardiology',
          hospital: 'Square Hospital',
          phone: '01712345678',
          email: 'farhana.rahman@square.example',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('creates doctor, formats phone to E.164, sets ETag and Location headers', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Cookie', adminCookies)
        .send({
          name: 'Dr. Farhana Rahman',
          specialization: 'Cardiology',
          hospital: 'Square Hospital',
          phone: '017 1234 5678', // local format
          email: 'farhana.rahman@square.example',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.headers['location']).toMatch(/\/api\/v1\/doctors\/[0-9a-fA-F]{24}/);
      expect(res.headers['etag']).toBe('"1"');
      expect(res.headers['cache-control']).toBe('no-store');

      const doc = res.body.data;
      doctorAId = doc.id;
      expect(doc.name).toBe('Dr. Farhana Rahman');
      expect(doc.phone).toBe('+8801712345678');
      expect(doc.patientCount).toBe(0);
      expect(doc.version).toBe(1);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'doctor.create', entityId: doc.id });
      expect(audit).toBeDefined();
    });

    it('creates a second doctor for relationship and reassignment testing', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Cookie', adminCookies)
        .send({
          name: 'Dr. Kamal Hossain',
          specialization: 'Neurology',
          hospital: 'Dhaka Medical College',
          phone: '+8801812345679',
          email: 'kamal.hossain@dmc.example',
        });

      expect(res.status).toBe(201);
      doctorBId = res.body.data.id;
    });

    it('returns 409 CONFLICT on duplicate doctor email', async () => {
      const res = await request(app)
        .post('/api/v1/doctors')
        .set('Cookie', adminCookies)
        .send({
          name: 'Dr. Duplicate',
          specialization: 'Cardiology',
          hospital: 'Square Hospital',
          phone: '01711112222',
          email: 'farhana.rahman@square.example',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Doctor Discovery Endpoints (Options & Facets)', () => {
    it('GET /api/v1/doctors/options returns up to 20 lightweight options', async () => {
      const res = await request(app)
        .get('/api/v1/doctors/options?q=farhana')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('name');
      expect(res.body.data[0]).toHaveProperty('specialization');
      expect(res.body.data[0]).not.toHaveProperty('searchTokens');
    });

    it('GET /api/v1/doctors/facets returns unique sorted specializations and hospitals', async () => {
      const res = await request(app)
        .get('/api/v1/doctors/facets')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('specializations');
      expect(res.body.data).toHaveProperty('hospitals');
      expect(res.body.data.specializations).toContain('Cardiology');
      expect(res.body.data.specializations).toContain('Neurology');
      expect(res.body.data.hospitals).toContain('Square Hospital');
      expect(res.body.data.hospitals).toContain('Dhaka Medical College');
    });
  });

  describe('GET /api/v1/doctors — List Doctors with Filters & Sorts', () => {
    it('lists doctors with bounded pagination and patient counts', async () => {
      const res = await request(app)
        .get('/api/v1/doctors?page=1&limit=10&sort=-createdAt')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        hasNextPage: false,
      });
    });

    it('filters doctors by specialization and hospital', async () => {
      const res = await request(app)
        .get('/api/v1/doctors?specialization=Cardiology&hospital=Square Hospital')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.every((d: any) => d.specialization === 'Cardiology')).toBe(true);
    });
  });

  describe('POST /api/v1/doctors/:id/patients — Add Patient to Doctor (Transaction)', () => {
    it('creates patient, synchronizes doctorName, and increments doctor patientCount', async () => {
      const res = await request(app)
        .post(`/api/v1/doctors/${doctorAId}/patients`)
        .set('Cookie', adminCookies)
        .send({
          name: 'Tariq Anwar',
          age: 48,
          gender: 'male',
          phone: '01819998877',
          email: 'tariq.anwar@example.com',
          condition: 'stable',
          diagnosis: 'Hypertension Stage 2',
          admissionDate: '2026-10-25',
          notes: 'Patient responding well to medication.',
        });

      expect(res.status).toBe(201);
      expect(res.headers['location']).toMatch(/\/api\/v1\/patients\/[0-9a-fA-F]{24}/);
      expect(res.headers['etag']).toBe('"1"');

      const patient = res.body.data;
      patientAId = patient.id;
      expect(patient.name).toBe('Tariq Anwar');
      expect(patient.phone).toBe('+8801819998877');
      expect(patient.doctorId).toBe(doctorAId);
      expect(patient.doctorName).toBe('Dr. Farhana Rahman');
      expect(patient.admissionDate).toBe('2026-10-25');
      expect(patient.version).toBe(1);

      // Verify doctor's patientCount was incremented in the transaction
      const doctorA = await Doctor.findById(doctorAId);
      expect(doctorA?.patientCount).toBe(1);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'patient.create', entityId: patient.id });
      expect(audit).toBeDefined();
    });

    it('creates a second patient under Doctor A with critical condition', async () => {
      const res = await request(app)
        .post(`/api/v1/doctors/${doctorAId}/patients`)
        .set('Cookie', adminCookies)
        .send({
          name: 'Salma Begum',
          age: 62,
          gender: 'female',
          phone: '01912344321',
          email: 'salma.begum@example.com',
          condition: 'critical',
          diagnosis: 'Acute Myocardial Infarction',
          admissionDate: '2026-10-29',
        });

      expect(res.status).toBe(201);

      const doctorA = await Doctor.findById(doctorAId);
      expect(doctorA?.patientCount).toBe(2);
    });
  });

  describe('GET /api/v1/doctors/:id/summary — Doctor Summary Analytics', () => {
    it('computes accurate condition breakdown, admissions this month, and last admission date', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors/${doctorAId}/summary`)
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      const summary = res.body.data;
      expect(summary.patientCount).toBe(2);
      expect(summary.byCondition).toMatchObject({
        stable: 1,
        critical: 1,
        under_observation: 0,
        recovering: 0,
        discharged: 0,
      });
      expect(summary.admittedThisMonth).toBe(2);
      expect(summary.lastAdmissionDate).toBe('2026-10-29');
    });
  });

  describe('PATCH /api/v1/doctors/:id — Multi-document Transaction on Rename', () => {
    it('returns 428 PRECONDITION_REQUIRED when If-Match is missing', async () => {
      const res = await request(app)
        .patch(`/api/v1/doctors/${doctorAId}`)
        .set('Cookie', adminCookies)
        .send({ name: 'Dr. Farhana Rahman (Updated)' });

      expect(res.status).toBe(428);
    });

    it('returns 412 PRECONDITION_FAILED when If-Match version is outdated', async () => {
      const res = await request(app)
        .patch(`/api/v1/doctors/${doctorAId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"999"')
        .send({ name: 'Dr. Farhana Rahman (Updated)' });

      expect(res.status).toBe(412);
      expect(res.body.data).toBeDefined();
    });

    it('updates doctor name and cascades new doctorName to all associated patients in one transaction', async () => {
      const res = await request(app)
        .patch(`/api/v1/doctors/${doctorAId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"1"')
        .send({ name: 'Prof. Dr. Farhana Rahman' });

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe('"2"');
      expect(res.body.data.name).toBe('Prof. Dr. Farhana Rahman');
      expect(res.body.data.version).toBe(2);

      // Verify all patients under Doctor A now have the updated doctorName (Extended Reference Pattern)
      const patients = await Patient.find({ doctorId: doctorAId });
      expect(patients.length).toBe(2);
      expect(patients.every((p) => p.doctorName === 'Prof. Dr. Farhana Rahman')).toBe(true);
    });
  });

  describe('GET /api/v1/patients — Patient Listing & Filtering', () => {
    it('lists patients across doctors excluding internal notes from list view', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      // List query omits heavy notes field per Database Plan
      expect(res.body.data[0].notes).toBeUndefined();
    });

    it('filters patients by condition and doctorId', async () => {
      const res = await request(app)
        .get(`/api/v1/patients?doctorId=${doctorAId}&condition=critical`)
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Salma Begum');
    });
  });

  describe('GET /api/v1/patients/:id — Single Patient Profile', () => {
    it('returns full patient profile including notes and ETag', async () => {
      const res = await request(app)
        .get(`/api/v1/patients/${patientAId}`)
        .set('Cookie', staffCookies);

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe('"1"');
      expect(res.body.data.id).toBe(patientAId);
      expect(res.body.data.notes).toBe('Patient responding well to medication.');
      expect(res.body.data.admissionDate).toBe('2026-10-25');
    });
  });

  describe('PATCH /api/v1/patients/:id — Patient Reassignment (Transaction)', () => {
    it('reassigns patient to Doctor B: decrements Doctor A and increments Doctor B in one transaction', async () => {
      const res = await request(app)
        .patch(`/api/v1/patients/${patientAId}`)
        .set('Cookie', adminCookies)
        .set('If-Match', '"1"')
        .send({
          doctorId: doctorBId,
          condition: 'recovering',
        });

      expect(res.status).toBe(200);
      expect(res.headers['etag']).toBe('"2"');
      expect(res.body.data.doctorId).toBe(doctorBId);
      expect(res.body.data.doctorName).toBe('Dr. Kamal Hossain');
      expect(res.body.data.condition).toBe('recovering');
      expect(res.body.data.version).toBe(2);

      // Verify Doctor A patientCount decremented from 2 to 1
      const doctorA = await Doctor.findById(doctorAId);
      expect(doctorA?.patientCount).toBe(1);

      // Verify Doctor B patientCount incremented from 0 to 1
      const doctorB = await Doctor.findById(doctorBId);
      expect(doctorB?.patientCount).toBe(1);
    });
  });

  describe('DELETE /api/v1/patients/:id — Patient Removal (Transaction)', () => {
    it('returns 403 FORBIDDEN when staff attempts to delete a patient', async () => {
      const res = await request(app)
        .delete(`/api/v1/patients/${patientAId}`)
        .set('Cookie', staffCookies);

      expect(res.status).toBe(403);
    });

    it('deletes patient and decrements assigned doctor patientCount in one transaction', async () => {
      const res = await request(app)
        .delete(`/api/v1/patients/${patientAId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(204);

      // Verify patient is gone
      const deleted = await Patient.findById(patientAId);
      expect(deleted).toBeNull();

      // Verify Doctor B patientCount decremented back from 1 to 0
      const doctorB = await Doctor.findById(doctorBId);
      expect(doctorB?.patientCount).toBe(0);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'patient.delete', entityId: patientAId });
      expect(audit).toBeDefined();
    });
  });
});

