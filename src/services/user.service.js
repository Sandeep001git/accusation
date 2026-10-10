// Encapsulate database reads and mutations for user account management.
import { desc, eq } from "drizzle-orm";
import { db } from "#config/database.js";
import { users } from "#models/user.model.js";

const publicFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const isEmailConflict = (error) => {
  for (let current = error; current; current = current.cause) {
    if (
      current.code === "23505" &&
      current.constraint === "users_email_unique"
    ) {
      return true;
    }
  }
  return false;
};

export const listUsers = async ({ page, limit }) => {
  const records = await db
    .select(publicFields)
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const hasMore = records.length > limit;
  return { items: records.slice(0, limit), page, limit, hasMore };
};

export const getUserById = async (id) => {
  const [user] = await db
    .select(publicFields)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
};

export const updateUser = async (id, changes) => {
  try {
    const [user] = await db
      .update(users)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(publicFields);
    return user ?? null;
  } catch (error) {
    if (isEmailConflict(error)) {
      const conflict = new Error("Email already exists", { cause: error });
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
};

export const deleteUser = async (id) => {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return Boolean(deleted);
};
