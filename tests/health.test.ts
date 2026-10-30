import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health Check API', () => {
  it('GET /health returns 200 with standard response structure', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Backend API is running smoothly');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });
});

