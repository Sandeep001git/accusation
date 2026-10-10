// Validate user IDs, pagination, and explicitly permitted profile updates.
import { z } from "zod";
import {
  userEmailSchema,
  userNameSchema,
} from "#validations/auth.validation.js";

export const updateUserSchema = z
  .object({
    name: userNameSchema.optional(),
    email: userEmailSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const userIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().safe());

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
