import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Redoc & OpenAPI Documentation API', () => {
  it('GET /api-docs returns HTML page containing Redoc configuration', async () => {
    const res = await request(app).get('/api-docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('Redoc.init');
    expect(res.text).toContain('/openapi.yaml');
  });

  it('GET /openapi.yaml returns valid OpenAPI 3.1 YAML definition', async () => {
    const res = await request(app).get('/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/yaml/);
    expect(res.text).toContain('openapi: 3.1.0');
    expect(res.text).toContain('title: Doctor & Patient Management System API');
    expect(res.text).toContain('/auth/login:');
    expect(res.text).toContain('/doctors:');
    expect(res.text).toContain('/patients:');
    expect(res.text).toContain('/dashboard/stats:');
  });
});

