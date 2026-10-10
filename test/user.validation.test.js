// Verify profile update, identifier, and pagination input constraints.
import test from "node:test";
import assert from "node:assert/strict";
import {
  listUsersSchema,
  updateUserSchema,
  userIdSchema,
} from "../src/validations/user.validation.js";

test("user updates accept normalized profile fields only", () => {
  assert.deepEqual(
    updateUserSchema.parse({ name: "  New Name ", email: " A@Example.com " }),
    { name: "New Name", email: "a@example.com" },
  );
  assert.equal(updateUserSchema.safeParse({}).success, false);
  assert.equal(updateUserSchema.safeParse({ role: "admin" }).success, false);
  assert.equal(
    updateUserSchema.safeParse({ password: "secret" }).success,
    false,
  );
});

test("user updates validate field lengths and email format", () => {
  assert.equal(updateUserSchema.safeParse({ name: "ab" }).success, false);
  assert.equal(
    updateUserSchema.safeParse({ name: "n".repeat(31) }).success,
    false,
  );
  assert.equal(
    updateUserSchema.safeParse({ email: "not-an-email" }).success,
    false,
  );
});

test("user IDs and pagination reject invalid ranges", () => {
  assert.equal(userIdSchema.parse("10"), 10);
  assert.equal(userIdSchema.safeParse("0").success, false);
  assert.deepEqual(listUsersSchema.parse({}), { page: 1, limit: 20 });
  assert.equal(listUsersSchema.safeParse({ limit: "101" }).success, false);
});
