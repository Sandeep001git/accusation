/* eslint-disable preserve-caught-error */
import bcrypt from "bcrypt";
import { logger } from "#config/logger.js";
import { db } from "#config/database.js";
import { eq } from "drizzle-orm";
import { users } from "#models/user.model.js";

export const hashPassword = (password) => {
  try {
    return bcrypt.hashSync(password, 10);
  } catch (error) {
    logger.error("Error occurred while hashing password", error);
    throw new Error("Error occurred while hashing password");
  }
};

export const createUser = async ({ name, email, password, role = "user" }) => {
  try {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }
    const hashedPassword = hashPassword(password);
    const now = new Date();

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      });

    logger.info("User created successfully", {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
    return newUser;
  } catch (error) {
    logger.error("Error occurred while creating user", error);
    throw error;
  }
};

export const authenticateUser = async ({ email, password }) => {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      password: users.password,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};
