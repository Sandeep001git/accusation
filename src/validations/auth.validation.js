import { z } from "zod";

export const userNameSchema = z.string().trim().min(3).max(30);
export const userEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(255));

export const signUpSchema = z.object({
  name: userNameSchema,
  email: userEmailSchema,
  password: z.string().min(6),
});

export const signInSchema = z.object({
  email: userEmailSchema,
  password: z.string().min(6),
});
