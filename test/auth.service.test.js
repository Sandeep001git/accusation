import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const selectLimit = jest.fn();
const selectWhere = jest.fn(() => ({ limit: selectLimit }));
const selectFrom = jest.fn(() => ({ where: selectWhere }));
const select = jest.fn(() => ({ from: selectFrom }));

const insertReturning = jest.fn();
const insertValues = jest.fn(() => ({ returning: insertReturning }));
const insert = jest.fn(() => ({ values: insertValues }));

const hash = jest.fn();
const compare = jest.fn();

jest.unstable_mockModule('#config/database.js', () => ({
  db: { select, insert },
}));
jest.unstable_mockModule('bcrypt', () => ({
  default: { hash, compare },
}));
jest.unstable_mockModule('#config/logger.js', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

const { authenticateUser, createUser, hashPassword } =
  await import('../src/services/auth.service.js');

const credentials = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'StrongPassword123!',
};
const publicUser = {
  id: 12,
  name: credentials.name,
  email: credentials.email,
  role: 'user',
};

describe('authentication service', () => {
  beforeEach(() => {
    select.mockClear();
    selectFrom.mockClear();
    selectWhere.mockClear();
    selectLimit.mockReset();
    insert.mockClear();
    insertValues.mockClear();
    insertReturning.mockReset();
    hash.mockReset().mockResolvedValue('secure-hash');
    compare.mockReset();
  });

  test('hashes passwords with the configured work factor', async () => {
    await expect(hashPassword(credentials.password)).resolves.toBe(
      'secure-hash'
    );
    expect(hash).toHaveBeenCalledWith(credentials.password, 10);
  });

  test('wraps and preserves password hashing failures', async () => {
    const cause = new Error('hash implementation failed');
    hash.mockRejectedValue(cause);

    await expect(hashPassword(credentials.password)).rejects.toMatchObject({
      message: 'Error occurred while hashing password',
      cause,
    });
  });

  test('creates an account with a hashed password and default role', async () => {
    selectLimit.mockResolvedValue([]);
    insertReturning.mockResolvedValue([publicUser]);

    await expect(createUser(credentials)).resolves.toEqual(publicUser);

    expect(hash).toHaveBeenCalledWith(credentials.password, 10);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: credentials.name,
        email: credentials.email,
        password: 'secure-hash',
        role: 'user',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
  });

  test('rejects duplicate email before hashing or inserting', async () => {
    selectLimit.mockResolvedValue([{ id: 1 }]);

    await expect(createUser(credentials)).rejects.toThrow(
      'User with this email already exists'
    );

    expect(hash).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  test('converts an email uniqueness race into a duplicate-email error', async () => {
    selectLimit.mockResolvedValue([]);
    insertReturning.mockRejectedValue(
      Object.assign(new Error('unique violation'), {
        code: '23505',
        constraint: 'users_email_unique',
      })
    );

    await expect(createUser(credentials)).rejects.toMatchObject({
      message: 'User with this email already exists',
      cause: expect.any(Error),
    });
  });

  test('authenticates valid credentials and returns only public fields', async () => {
    selectLimit.mockResolvedValue([{ ...publicUser, password: 'stored-hash' }]);
    compare.mockResolvedValue(true);

    await expect(
      authenticateUser({
        email: credentials.email,
        password: credentials.password,
      })
    ).resolves.toEqual(publicUser);
    expect(compare).toHaveBeenCalledWith(credentials.password, 'stored-hash');
  });

  test('rejects an unknown email without comparing passwords', async () => {
    selectLimit.mockResolvedValue([]);

    await expect(
      authenticateUser({
        email: credentials.email,
        password: credentials.password,
      })
    ).resolves.toBeNull();
    expect(compare).not.toHaveBeenCalled();
  });

  test('rejects an incorrect password', async () => {
    selectLimit.mockResolvedValue([{ ...publicUser, password: 'stored-hash' }]);
    compare.mockResolvedValue(false);

    await expect(
      authenticateUser({
        email: credentials.email,
        password: 'wrong-password',
      })
    ).resolves.toBeNull();
  });
});
