import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const selectLimit = jest.fn();
const selectOffset = jest.fn();
const selectOrderBy = jest.fn(() => ({ limit: selectLimit }));
const selectWhere = jest.fn(() => ({ limit: selectLimit }));
const selectFrom = jest.fn(() => ({
  orderBy: selectOrderBy,
  where: selectWhere,
}));
const select = jest.fn(() => ({ from: selectFrom }));

const updateReturning = jest.fn();
const updateWhere = jest.fn(() => ({ returning: updateReturning }));
const updateSet = jest.fn(() => ({ where: updateWhere }));
const update = jest.fn(() => ({ set: updateSet }));

const deleteReturning = jest.fn();
const deleteWhere = jest.fn(() => ({ returning: deleteReturning }));
const deleteRecord = jest.fn(() => ({ where: deleteWhere }));

jest.unstable_mockModule("#config/database.js", () => ({
  db: { select, update, delete: deleteRecord },
}));

const { deleteUser, getUserById, listUsers, updateUser } =
  await import("../src/services/user.service.js");

const user = {
  id: 3,
  name: "Test User",
  email: "test@example.com",
  role: "user",
};

describe("user service", () => {
  beforeEach(() => {
    select.mockClear();
    selectFrom.mockClear();
    selectWhere.mockClear();
    selectOrderBy.mockClear();
    selectLimit.mockReset();
    selectOffset.mockReset();
    update.mockClear();
    updateSet.mockClear();
    updateWhere.mockClear();
    updateReturning.mockReset();
    deleteRecord.mockClear();
    deleteWhere.mockClear();
    deleteReturning.mockReset();
  });

  test("lists a page and indicates whether more records exist", async () => {
    selectLimit.mockReturnValue({ offset: selectOffset });
    selectOffset.mockResolvedValue([
      user,
      { ...user, id: 4 },
      { ...user, id: 5 },
    ]);

    const result = await listUsers({ page: 2, limit: 2 });

    expect(result).toEqual({
      items: [user, { ...user, id: 4 }],
      page: 2,
      limit: 2,
      hasMore: true,
    });
    expect(selectLimit).toHaveBeenCalledWith(3);
    expect(selectOffset).toHaveBeenCalledWith(2);
  });

  test("returns an empty page without claiming more records exist", async () => {
    selectLimit.mockReturnValue({ offset: selectOffset });
    selectOffset.mockResolvedValue([]);

    await expect(listUsers({ page: 1, limit: 20 })).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      hasMore: false,
    });
  });

  test("returns one user by ID or null when absent", async () => {
    selectLimit.mockResolvedValue([user]);
    await expect(getUserById(3)).resolves.toEqual(user);

    selectLimit.mockResolvedValue([]);
    await expect(getUserById(9)).resolves.toBeNull();
  });

  test("updates permitted data and updates the timestamp", async () => {
    updateReturning.mockResolvedValue([user]);

    await expect(updateUser(3, { name: "Test User" })).resolves.toEqual(user);

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test User",
        updatedAt: expect.any(Date),
      })
    );
    expect(updateReturning).toHaveBeenCalledTimes(1);
  });

  test("returns null when the update target does not exist", async () => {
    updateReturning.mockResolvedValue([]);

    await expect(updateUser(9, { name: "Missing" })).resolves.toBeNull();
  });

  test("converts a nested email uniqueness violation into a conflict", async () => {
    const databaseError = Object.assign(new Error("unique violation"), {
      code: "23505",
      constraint: "users_email_unique",
    });
    updateReturning.mockRejectedValue(
      new Error("database update failed", { cause: databaseError })
    );

    await expect(
      updateUser(3, { email: "taken@example.com" })
    ).rejects.toMatchObject({
      message: "Email already exists",
      status: 409,
      cause: expect.any(Error),
    });
  });

  test("does not convert unrelated database errors", async () => {
    const error = new Error("database unavailable");
    updateReturning.mockRejectedValue(error);

    await expect(updateUser(3, { name: "Updated" })).rejects.toBe(error);
  });

  test("deletes an existing account", async () => {
    deleteReturning.mockResolvedValue([{ id: 3 }]);

    await expect(deleteUser(3)).resolves.toBe(true);
  });

  test("returns false when the account to delete does not exist", async () => {
    deleteReturning.mockResolvedValue([]);

    await expect(deleteUser(9)).resolves.toBe(false);
  });
});
