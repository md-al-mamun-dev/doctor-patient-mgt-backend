import { describe, it, expect } from 'vitest';
import { User } from '../src/models/User.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { Doctor } from '../src/models/Doctor.js';
import { Patient } from '../src/models/Patient.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateSearchTokens } from '../src/utils/searchTokens.js';

describe('Search Tokens Utility', () => {
  it('generates lowercased tokens from names, text, and phone numbers', () => {
    const tokens = generateSearchTokens([
      'Dr. Farhana Rahman',
      'Cardiology',
      'Dhaka Medical College',
      '+8801712345678',
    ]);

    expect(tokens).toContain('dr');
    expect(tokens).toContain('farhana');
    expect(tokens).toContain('rahman');
    expect(tokens).toContain('cardiology');
    expect(tokens).toContain('dhaka');
    expect(tokens).toContain('medical');
    expect(tokens).toContain('college');
    expect(tokens).toContain('8801712345678');
  });
});

describe('Database Models Schema Definitions', () => {
  it('defines User schema with required fields and email index', () => {
    const emailIndex = User.schema.indexes().find(([keys]) => 'email' in keys);
    expect(emailIndex).toBeDefined();
    expect(User.schema.path('email')).toBeDefined();
    expect(User.schema.path('role')).toBeDefined();
    expect(User.schema.path('status')).toBeDefined();
  });

  it('defines RefreshToken schema with tokenHash and TTL index', () => {
    const indexes = RefreshToken.schema.indexes();
    const tokenHashIndex = indexes.find(([keys]) => 'tokenHash' in keys);
    const ttlIndex = indexes.find(([keys, opts]) => 'expiresAt' in keys && opts?.expireAfterSeconds === 0);

    expect(tokenHashIndex).toBeDefined();
    expect(ttlIndex).toBeDefined();
    expect(RefreshToken.schema.path('familyId')).toBeDefined();
  });

  it('defines Doctor schema with searchTokens, collation, and compound indexes', () => {
    const indexes = Doctor.schema.indexes();
    const compoundSpecialization = indexes.find(
      ([keys]) => 'specialization' in keys && 'createdAt' in keys
    );
    const collationIndex = indexes.find(
      ([keys, opts]) => 'name' in keys && opts?.collation?.locale === 'en'
    );
    const searchTokenIndex = indexes.find(([keys]) => 'searchTokens' in keys);

    expect(compoundSpecialization).toBeDefined();
    expect(collationIndex).toBeDefined();
    expect(searchTokenIndex).toBeDefined();
    expect(Doctor.schema.path('patientCount')).toBeDefined();
  });

  it('defines Patient schema with doctorName, condition, and admissionDate indexes', () => {
    const indexes = Patient.schema.indexes();
    const doctorAdmission = indexes.find(
      ([keys]) => 'doctorId' in keys && 'admissionDate' in keys
    );
    const conditionAdmission = indexes.find(
      ([keys]) => 'condition' in keys && 'admissionDate' in keys
    );

    expect(doctorAdmission).toBeDefined();
    expect(conditionAdmission).toBeDefined();
    expect(Patient.schema.path('doctorName')).toBeDefined();
    expect(Patient.schema.path('condition')).toBeDefined();
  });

  it('defines AuditLog schema with 365-day TTL index', () => {
    const indexes = AuditLog.schema.indexes();
    const ttlIndex = indexes.find(
      ([keys, opts]) => 'at' in keys && opts?.expireAfterSeconds === 31536000
    );

    expect(ttlIndex).toBeDefined();
    expect(AuditLog.schema.path('action')).toBeDefined();
    expect(AuditLog.schema.path('fields')).toBeDefined();
  });
});

