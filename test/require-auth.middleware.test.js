// Verify missing, invalid, and malformed authentication tokens are rejected.
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET ||= "test-only-jwt-secret";
const { default: requireAuth } =
  await import("../src/middleware/require-auth.middleware.js");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("rejects requests without an authentication cookie", () => {
  const res = response();
  let nextCalled = false;

  requireAuth({ cookies: {} }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects invalid tokens", () => {
  const res = response();
  requireAuth({ cookies: { token: "invalid" } }, res, () => {});
  assert.equal(res.statusCode, 401);
});

test("rejects a signed token with an invalid user identity", () => {
  const token = jwt.sign(
    { id: "not-an-id", role: "admin" },
    process.env.JWT_SECRET,
    {
      expiresIn: "1m",
    },
  );
  const req = { cookies: { token }, body: { userId: 123 } };
  const res = response();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(req.user, undefined);
  assert.equal(res.statusCode, 401);
});
