// Verify user ownership and admin access rules.
import { describe, expect, test } from "@jest/globals";
import { canAccessUser, isAdmin } from "../src/utils/user-authorization.js";

describe("user authorization", () => {
  test("users may access only their own account", () => {
    const actor = { id: 4, role: "user" };

    expect(canAccessUser(actor, 4)).toBe(true);
    expect(canAccessUser(actor, 5)).toBe(false);
    expect(isAdmin(actor)).toBe(false);
  });

  test("admins may access other user accounts", () => {
    const actor = { id: 4, role: "admin" };

    expect(canAccessUser(actor, 5)).toBe(true);
    expect(isAdmin(actor)).toBe(true);
  });
});
