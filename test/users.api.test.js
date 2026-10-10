// Exercise user routes over HTTP without connecting to a real database.
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const JWT_SECRET = 'test-only-api-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

let authenticatedUser = null;
const dbLimit = jest.fn(async () =>
  authenticatedUser ? [authenticatedUser] : []
);
const dbWhere = jest.fn(() => ({ limit: dbLimit }));
const dbFrom = jest.fn(() => ({ where: dbWhere }));
const dbSelect = jest.fn(() => ({ from: dbFrom }));

const service = {
  deleteUser: jest.fn(),
  getUserById: jest.fn(),
  listUsers: jest.fn(),
  updateUser: jest.fn(),
};
const createUser = jest.fn();

jest.unstable_mockModule('#config/database.js', () => ({
  db: { select: dbSelect },
  sql: jest.fn(),
}));
jest.unstable_mockModule('#middleware/security.middleware.js', () => ({
  default: (req, res, next) => next(),
}));
jest.unstable_mockModule('#services/user.service.js', () => service);
jest.unstable_mockModule('#services/auth.service.js', () => ({
  authenticateUser: jest.fn(),
  createUser,
}));

const { default: app } = await import('../src/app.js');

const user = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const otherUser = {
  ...user,
  id: 2,
  name: 'Other User',
  email: 'other@example.com',
};

const authCookie = (id = 1, role = 'user') =>
  `token=${jwt.sign({ id, role }, JWT_SECRET)}`;

describe('user API routes', () => {
  beforeEach(() => {
    authenticatedUser = { id: 1, role: 'user' };
    dbLimit.mockClear();
    dbWhere.mockClear();
    dbFrom.mockClear();
    dbSelect.mockClear();
    service.deleteUser.mockReset();
    service.getUserById.mockReset();
    service.listUsers.mockReset();
    service.updateUser.mockReset();
    createUser.mockReset();
  });

  test('creates an account through the existing signup flow', async () => {
    createUser.mockResolvedValue(user);

    const response = await request(app).post('/api/users').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'StrongPassword123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    expect(response.headers['set-cookie'][0]).toContain('token=');
    expect(createUser).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      password: 'StrongPassword123!',
    });
  });

  test('rejects invalid signup input', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid', password: 'short' });

    expect(response.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  test('requires authentication for account reads', async () => {
    const response = await request(app).get('/api/users/me');

    expect(response.status).toBe(401);
    expect(service.getUserById).not.toHaveBeenCalled();
  });

  test("retrieves the authenticated user's account", async () => {
    service.getUserById.mockResolvedValue(user);

    const response = await request(app)
      .get('/api/users/me')
      .set('Cookie', authCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user });
    expect(service.getUserById).toHaveBeenCalledWith(1);
  });

  test('updates only permitted profile fields', async () => {
    const updatedUser = { ...user, name: 'Updated Name' };
    service.updateUser.mockResolvedValue(updatedUser);

    const response = await request(app)
      .patch('/api/users/me')
      .set('Cookie', authCookie())
      .send({ name: 'Updated Name' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: updatedUser });
    expect(service.updateUser).toHaveBeenCalledWith(1, {
      name: 'Updated Name',
    });
  });

  test('rejects attempts to change protected account fields', async () => {
    const response = await request(app)
      .patch('/api/users/me')
      .set('Cookie', authCookie())
      .send({ role: 'admin' });

    expect(response.status).toBe(400);
    expect(service.updateUser).not.toHaveBeenCalled();
  });

  test("deletes the authenticated user's account and clears the cookie", async () => {
    service.deleteUser.mockResolvedValue(true);

    const response = await request(app)
      .delete('/api/users/me')
      .set('Cookie', authCookie());

    expect(response.status).toBe(204);
    expect(response.headers['set-cookie'][0]).toContain('token=');
    expect(response.headers['set-cookie'][0]).toMatch(/Expires=/i);
    expect(service.deleteUser).toHaveBeenCalledWith(1);
  });

  test('forbids regular users from listing accounts', async () => {
    const response = await request(app)
      .get('/api/users')
      .set('Cookie', authCookie());

    expect(response.status).toBe(403);
    expect(service.listUsers).not.toHaveBeenCalled();
  });

  test('allows admins to list accounts with validated pagination', async () => {
    const page = { items: [user], page: 2, limit: 5, hasMore: false };
    authenticatedUser = { id: 9, role: 'admin' };
    service.listUsers.mockResolvedValue(page);

    const response = await request(app)
      .get('/api/users?page=2&limit=5')
      .set('Cookie', authCookie(9, 'admin'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(page);
    expect(service.listUsers).toHaveBeenCalledWith({ page: 2, limit: 5 });
  });

  test('rejects invalid list pagination', async () => {
    authenticatedUser = { id: 9, role: 'admin' };

    const response = await request(app)
      .get('/api/users?limit=101')
      .set('Cookie', authCookie(9, 'admin'));

    expect(response.status).toBe(400);
    expect(service.listUsers).not.toHaveBeenCalled();
  });

  test("hides another user's record from regular users", async () => {
    const response = await request(app)
      .get('/api/users/2')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(service.getUserById).not.toHaveBeenCalled();
  });

  test("allows admins to retrieve another user's record", async () => {
    authenticatedUser = { id: 9, role: 'admin' };
    service.getUserById.mockResolvedValue(otherUser);

    const response = await request(app)
      .get('/api/users/2')
      .set('Cookie', authCookie(9, 'admin'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: otherUser });
    expect(service.getUserById).toHaveBeenCalledWith(2);
  });

  test('validates account IDs before looking up accounts', async () => {
    const response = await request(app)
      .get('/api/users/invalid')
      .set('Cookie', authCookie());

    expect(response.status).toBe(400);
    expect(service.getUserById).not.toHaveBeenCalled();
  });

  test('returns not found when an account does not exist', async () => {
    service.getUserById.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/users/99')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'User not found' });
  });

  test("prevents users from updating another user's account", async () => {
    const response = await request(app)
      .patch('/api/users/2')
      .set('Cookie', authCookie())
      .send({ name: 'Changed' });

    expect(response.status).toBe(404);
    expect(service.updateUser).not.toHaveBeenCalled();
  });

  test("prevents users from deleting another user's account", async () => {
    const response = await request(app)
      .delete('/api/users/2')
      .set('Cookie', authCookie());

    expect(response.status).toBe(404);
    expect(service.deleteUser).not.toHaveBeenCalled();
  });

  test('returns conflict for duplicate email updates', async () => {
    const conflict = new Error('Email already exists');
    conflict.status = 409;
    service.updateUser.mockRejectedValue(conflict);

    const response = await request(app)
      .patch('/api/users/me')
      .set('Cookie', authCookie())
      .send({ email: 'taken@example.com' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Email already exists' });
  });
});
