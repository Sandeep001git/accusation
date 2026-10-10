// Verify missing, invalid, and malformed authentication tokens are rejected.
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || " JWT-TOKEN";

const dbLimit = jest.fn();
const dbWhere = jest.fn(() => ({ limit: dbLimit }));
const dbFrom = jest.fn(() => ({ where: dbWhere }));
const dbSelect = jest.fn(() => ({ from: dbFrom }));

jest.unstable_mockModule("#config/database.js", () => ({
  db: { select: dbSelect },
}));

const { default: requireAuth } =
  await import("../src/middleware/require-auth.middleware.js");

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("authentication middleware", () => {
  beforeEach(() => {
    dbLimit.mockReset();
    dbLimit.mockResolvedValue([]);
    dbWhere.mockClear();
    dbFrom.mockClear();
    dbSelect.mockClear();
  });

  test("rejects requests without an authentication cookie", async () => {
    const req = { cookies: {} };
    const res = createResponse();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  test("rejects invalid tokens", async () => {
    const req = { cookies: { token: "invalid" } };
    const res = createResponse();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects signed tokens with invalid user identities", async () => {
    const token = jwt.sign({ id: "not-an-id", role: "admin" }, JWT_SECRET);
    const req = { cookies: { token }, body: { userId: 123 } };
    const res = createResponse();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  test("loads the role from the database instead of trusting the token", async () => {
    const token = jwt.sign({ id: 7, role: "admin" }, JWT_SECRET);
    const req = { cookies: { token } };
    const res = createResponse();
    const next = jest.fn();
    dbLimit.mockResolvedValue([{ id: 7, role: "user" }]);

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 7, role: "user" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("rejects valid tokens for accounts that no longer exist", async () => {
    const token = jwt.sign({ id: 7 }, JWT_SECRET);
    const req = { cookies: { token } };
    const res = createResponse();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("passes database errors to Express error handling", async () => {
    const token = jwt.sign({ id: 7 }, JWT_SECRET);
    const req = { cookies: { token } };
    const res = createResponse();
    const error = new Error("database unavailable");
    const next = jest.fn();
    dbLimit.mockRejectedValue(error);

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
