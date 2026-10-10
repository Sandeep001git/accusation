// Verify profile update, identifier, and pagination input constraints.
import { describe, expect, test } from "@jest/globals";
import {
  listUsersSchema,
  updateUserSchema,
  userIdSchema,
} from "../src/validations/user.validation.js";

describe("user request validation", () => {
  test("normalizes permitted profile fields and rejects mass assignment", () => {
    expect(
      updateUserSchema.parse({ name: "  New Name ", email: " A@Example.com " }),
    ).toEqual({ name: "New Name", email: "a@example.com" });
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ password: "secret" }).success).toBe(
      false,
    );
  });

  test("validates profile field lengths and email format", () => {
    expect(updateUserSchema.safeParse({ name: "ab" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ name: "n".repeat(31) }).success).toBe(
      false,
    );
    expect(updateUserSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  test("validates user IDs and pagination ranges", () => {
    expect(userIdSchema.parse("10")).toBe(10);
    expect(userIdSchema.safeParse("0").success).toBe(false);
    expect(listUsersSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listUsersSchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
