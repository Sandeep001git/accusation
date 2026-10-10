// Verify user ownership and admin access rules.
import test from "node:test";
import assert from "node:assert/strict";
import { canAccessUser, isAdmin } from "../src/utils/user-authorization.js";

test("users may access only their own account", () => {
  const actor = { id: 4, role: "user" };

  assert.equal(canAccessUser(actor, 4), true);
  assert.equal(canAccessUser(actor, 5), false);
  assert.equal(isAdmin(actor), false);
});

test("admins may access other user accounts", () => {
  const actor = { id: 4, role: "admin" };

  assert.equal(canAccessUser(actor, 5), true);
  assert.equal(isAdmin(actor), true);
});
