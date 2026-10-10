// Handle user account requests and enforce profile ownership and admin access.
import { signUp } from "#controllers/auth.controller.js";
import { logger } from "#config/logger.js";
import { cookie } from "#utils/cookies.js";
import { formatValidationErrors } from "#utils/format.js";
import {
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
} from "#services/user.service.js";
import {
  listUsersSchema,
  updateUserSchema,
  userIdSchema,
} from "#validations/user.validation.js";
import { canAccessUser, isAdmin } from "#utils/user-authorization.js";

const failValidation = (res, error) =>
  res.status(400).json({
    error: "Validation failed",
    details: formatValidationErrors(error),
  });

const parseId = (value, res) => {
  const result = userIdSchema.safeParse(value);
  if (!result.success) {
    failValidation(res, result.error);
    return null;
  }
  return result.data;
};

const authorizeTarget = (req, res, id) => {
  if (!canAccessUser(req.user, id)) {
    res.status(404).json({ error: "User not found" });
    return false;
  }
  return true;
};

export { signUp as create };

export const list = async (req, res) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const result = listUsersSchema.safeParse(req.query);
  if (!result.success) {
    return failValidation(res, result.error);
  }
  return res.status(200).json(await listUsers(result.data));
};

export const read = async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null || !authorizeTarget(req, res, id)) return;

  const user = await getUserById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json({ user });
};

export const readMe = async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json({ user });
};

const updateById = async (id, req, res) => {
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    return failValidation(res, result.error);
  }

  const user = await updateUser(id, result.data);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json({ user });
};

export const update = async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null || !authorizeTarget(req, res, id)) return;
  return updateById(id, req, res);
};

export const updateMe = (req, res) => {
  return updateById(req.user.id, req, res);
};

const removeById = async (id, req, res) => {
  if (!(await deleteUser(id))) {
    return res.status(404).json({ error: "User not found" });
  }
  if (id === req.user.id) {
    cookie.clear(res, "token");
  }
  logger.info("User account deleted", { id, actorId: req.user.id });
  return res.status(204).end();
};

export const remove = async (req, res) => {
  const id = parseId(req.params.id, res);
  if (id === null || !authorizeTarget(req, res, id)) return;
  return removeById(id, req, res);
};

export const removeMe = async (req, res) => {
  return removeById(req.user.id, req, res);
};
