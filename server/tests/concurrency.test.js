const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../server');
const { connectDatabase, closeDatabase } = require('../config/db');
const { seedServices } = require('../seed/seedServices');
const { seedStaff } = require('../seed/seedStaff');
const ServiceRequest = require('../models/ServiceRequest');
const Appointment = require('../models/Appointment');
const QueueEntry = require('../models/QueueEntry');

let student1Token = null;
let student2Token = null;
let staffToken = null;

function getFutureWeekdayDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

describe('Concurrency Test Suite (Section 50)', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_uniserve_2026';
    await connectDatabase();
    await seedServices();
    await seedStaff();

    // create student 1
    const s1Res = await request(app).post('/api/auth/signup').send({
      name: 'Student One',
      email: `conc1_${Date.now()}@uniserve.edu.au`,
      password: 'Password123!'
    });
    const s1Login = await request(app).post('/api/auth/login').send({
      email: s1Res.body.user.email,
      password: 'Password123!'
    });
    student1Token = s1Login.body.token;

    // create student 2
    const s2Res = await request(app).post('/api/auth/signup').send({
      name: 'Student Two',
      email: `conc2_${Date.now()}@uniserve.edu.au`,
      password: 'Password123!'
    });
    const s2Login = await request(app).post('/api/auth/login').send({
      email: s2Res.body.user.email,
      password: 'Password123!'
    });
    student2Token = s2Login.body.token;

    // login staff
    const staffLogin = await request(app).post('/api/auth/login').send({
      email: 'staff@uniserve.edu.au',
      password: 'StaffPassword123!'
    });
    staffToken = staffLogin.body.token;
  });

  after(async () => {
    await closeDatabase();
  });

  const validJpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString('base64');

  test('C02: Two students booking the exact same appointment slot concurrently', async () => {
    // student 1 creates a request
    const req1 = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        serviceId: 'IT001',
        description: 'First student inquiry for IT',
        evidence: {
          data: validJpegBase64,
          filename: 'test1.jpg'
        }
      });

    assert.equal(req1.status, 201);

    // student 2 creates a request
    const req2 = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        serviceId: 'IT001',
        description: 'Second student inquiry for IT',
        evidence: {
          data: validJpegBase64,
          filename: 'test2.jpg'
        }
      });

    assert.equal(req2.status, 201);

    const dateStr = getFutureWeekdayDate();
    const slotsRes = await request(app)
      .get(`/api/services/IT001/slots?date=${dateStr}`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.ok(slotsRes.body.slots.length > 0);
    const targetSlot = slotsRes.body.slots[0].slotStart;

    // both attempt to book the exact same slot concurrently
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          requestId: req1.body.request.requestId,
          slotStart: targetSlot
        }),
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${student2Token}`)
        .send({
          requestId: req2.body.request.requestId,
          slotStart: targetSlot
        })
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 409]);
  });

  test('C04: Ten simultaneous queue joins produce ten unique tokens', async () => {
    // create 10 requests for student 1 using WEL001 (queue enabled, no evidence required)
    const requestIds = [];
    for (let i = 0; i < 10; i++) {
      const r = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          serviceId: 'WEL001',
          description: `Queue stress test request ${i}`
        });
      assert.equal(r.status, 201);
      requestIds.push(r.body.request.requestId);
    }

    // simultaneously submit join queue for all 10 requests
    const joinPromises = requestIds.map(reqId =>
      request(app)
        .post('/api/queue')
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ requestId: reqId })
    );

    const responses = await Promise.all(joinPromises);
    const tokens = [];

    responses.forEach(res => {
      assert.equal(res.status, 201);
      assert.ok(res.body.queueEntry.token);
      tokens.push(res.body.queueEntry.token);
    });

    // ensure all 10 tokens are unique
    const uniqueTokens = new Set(tokens);
    assert.equal(uniqueTokens.size, 10);
  });
});
