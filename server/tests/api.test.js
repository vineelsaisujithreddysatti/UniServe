const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../server');
const { connectDatabase, closeDatabase } = require('../config/db');
const { seedServices } = require('../seed/seedServices');
const { seedStaff } = require('../seed/seedStaff');

let studentToken = null;
let staffToken = null;
let studentUserId = null;
let createdRequestId = null;
let bookedAppointmentId = null;
let createdQueueId = null;

describe('UniServe Test Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_uniserve_2026';
    await connectDatabase();
    await seedServices();
    await seedStaff();
  });

  after(async () => {
    await closeDatabase();
  });

  describe('Health Endpoint', () => {
    test('GET /api/health returns status ok', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });
  });

  describe('Authentication (Functional F01-F04 & Security S01-S04)', () => {
    const testStudent = {
      name: 'Alice Student',
      email: `alice_${Date.now()}@uniserve.edu.au`,
      password: 'SecurePassword123!'
    };

    test('F01: Student can successfully sign up', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testStudent);

      assert.equal(res.status, 201);
      assert.equal(res.body.user.email, testStudent.email.toLowerCase());
      assert.equal(res.body.user.role, 'student');
      studentUserId = res.body.user.userId;
    });

    test('F02: Duplicate email signup returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testStudent);

      assert.equal(res.status, 409);
      assert.equal(res.body.error, 'DUPLICATE_EMAIL');
    });

    test('F03: Student can login and receive JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.email,
          password: testStudent.password
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, 'student');
      studentToken = res.body.token;
    });

    test('F04 / S01: Invalid credentials returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testStudent.email,
          password: 'WrongPassword999!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'INVALID_CREDENTIALS');
    });

    test('Staff login works with seeded account', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'staff@uniserve.edu.au',
          password: 'StaffPassword123!'
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, 'staff');
      staffToken = res.body.token;
    });

    test('S02: Protected endpoint without JWT returns 401', async () => {
      const res = await request(app).get('/api/requests');
      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'UNAUTHORIZED');
    });

    test('S03: Protected endpoint with invalid JWT returns 401', async () => {
      const res = await request(app)
        .get('/api/requests')
        .set('Authorization', 'Bearer invalid_garbage_token');

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'INVALID_TOKEN');
    });
  });

  describe('Services (Functional F05-F07)', () => {
    test('F05: GET /api/services returns list of services', async () => {
      const res = await request(app).get('/api/services');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 5);
    });

    test('F06: GET /api/services/:id returns single service details', async () => {
      const res = await request(app).get('/api/services/IT001');
      assert.equal(res.status, 200);
      assert.equal(res.body.serviceId, 'IT001');
      assert.ok(Array.isArray(res.body.requirements));
    });

    test('F07: GET /api/services/:id/slots returns available slots', async () => {
      // grab a weekday 3 days from now
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);
      const dateStr = targetDate.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/services/IT001/slots?date=${dateStr}`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.serviceId, 'IT001');
      assert.ok(Array.isArray(res.body.slots));
    });
  });

  describe('Service Requests (Functional F08-F10 & Security S05-S09)', () => {
    test('F08: Student can create a service request with valid image evidence', async () => {
      // make a valid 4-byte jpeg buffer (FF D8 FF E0) in base64
      const validJpegBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString('base64');

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          serviceId: 'IT001',
          description: 'Cannot connect to campus eduroam Wi-Fi from library.',
          evidence: {
            data: validJpegBase64,
            filename: 'screenshot.jpg'
          }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'AWAITING_BOOKING');
      assert.equal(res.body.request.hasEvidence, true);
      createdRequestId = res.body.request.requestId;
    });

    test('S09: Image with invalid header bytes is rejected with 400', async () => {
      const invalidImageBase64 = Buffer.from('not an image at all').toString('base64');

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          serviceId: 'IT001',
          description: 'Test request with invalid image',
          evidence: {
            data: invalidImageBase64,
            filename: 'fake.jpg'
          }
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'INVALID_EVIDENCE');
    });

    test('F09: Student can retrieve their own request list', async () => {
      const res = await request(app)
        .get('/api/requests')
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      const found = res.body.find(r => r.requestId === createdRequestId);
      assert.ok(found);
      assert.equal(found.status, 'AWAITING_BOOKING');
    });

    test('F10: Student can retrieve evidence payload for their request', async () => {
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}/evidence`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data);
      assert.equal(res.body.mimeType, 'image/jpeg');
    });

    test('S06: Student cannot access another student request', async () => {
      // setup a second student account
      const student2Email = `student2_${Date.now()}@uniserve.edu.au`;
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Bob Student',
          email: student2Email,
          password: 'Password12345!'
        });
      assert.equal(signupRes.status, 201);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: student2Email,
          password: 'Password12345!'
        });
      const bobToken = loginRes.body.token;

      // bob attempts to inspect alice's request
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      // should return 404 so we don't leak whether request exists
      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'NOT_FOUND');
    });

    test('S05: Student calling staff-only update endpoint returns 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ status: 'UNDER_REVIEW' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'FORBIDDEN');
    });
  });

  function getNextWeekdayDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  }

  describe('Appointments & Cancellation/Rebooking (Functional F11-F15 & Concurrency C01-C02)', () => {
    let chosenSlotIso = null;

    test('F11: Retrieve valid future slots for appointment booking', async () => {
      const dateStr = getNextWeekdayDate();

      const res = await request(app)
        .get(`/api/services/IT001/slots?date=${dateStr}`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.slots.length > 0);
      chosenSlotIso = res.body.slots[0].slotStart;
    });

    test('F12: Student books appointment; request transitions to BOOKED_QUEUED', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestId: createdRequestId,
          slotStart: chosenSlotIso
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'BOOKED_QUEUED');
      assert.ok(res.body.appointment.appointmentId);
      bookedAppointmentId = res.body.appointment.appointmentId;
    });

    test('C01: Second booking attempt on same request returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestId: createdRequestId,
          slotStart: chosenSlotIso
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.error, 'INVALID_STATE');
    });

    test('F13: Cancel appointment; request transitions back to AWAITING_BOOKING', async () => {
      const res = await request(app)
        .delete(`/api/appointments/${bookedAppointmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.request.status, 'AWAITING_BOOKING');
    });

    test('F14: Student can rebook appointment following cancellation', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          requestId: createdRequestId,
          slotStart: chosenSlotIso
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'BOOKED_QUEUED');
      bookedAppointmentId = res.body.appointment.appointmentId;
    });

    test('Cancel again to prepare for queue workflow', async () => {
      const res = await request(app)
        .delete(`/api/appointments/${bookedAppointmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.request.status, 'AWAITING_BOOKING');
    });
  });

  describe('Virtual Queue Engine (Functional F16-F18 & Concurrency C04)', () => {
    test('F16: Student joins queue; receives token and request moves to BOOKED_QUEUED', async () => {
      const res = await request(app)
        .post('/api/queue')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ requestId: createdRequestId });

      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'BOOKED_QUEUED');
      assert.ok(res.body.queueEntry.token);
      assert.equal(res.body.queueEntry.status, 'WAITING');
      createdQueueId = res.body.queueEntry.queueId;
    });

    test('F17: Staff serves queue token; moves entry to SERVED and request to UNDER_REVIEW', async () => {
      const res = await request(app)
        .put(`/api/queue/${createdQueueId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.queueEntry.status, 'SERVED');
      assert.equal(res.body.request.status, 'UNDER_REVIEW');
    });
  });

  describe('Staff Review & Lifecycle Completion (Functional F19-F23 & Security S07-S08)', () => {
    test('S07: Invalid status transition by staff returns 400 Bad Request', async () => {
      // try skipping steps or going backwards
      const res = await request(app)
        .put(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'AWAITING_BOOKING' });

      assert.equal(res.status, 400);
      assert.equal(res.body.error, 'INVALID_TRANSITION');
    });

    test('Staff advances request to PROCESSING with response notes', async () => {
      const res = await request(app)
        .put(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          status: 'PROCESSING',
          staffResponse: 'IT Support is configuring your network profile settings.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.request.status, 'PROCESSING');
      assert.ok(res.body.request.staffResponse.includes('configuring'));
    });

    test('Staff completes request with final resolution note', async () => {
      const res = await request(app)
        .put(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          status: 'COMPLETED',
          staffResponse: 'Wi-Fi configuration profile successfully updated. Issue resolved.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.request.status, 'COMPLETED');
    });

    test('Student views updated request reflecting COMPLETED state and staff response', async () => {
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'COMPLETED');
      assert.ok(res.body.staffResponse.includes('Issue resolved'));
    });
  });
});
