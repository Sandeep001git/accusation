import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(3).max(30),
  email: z.string().trim().toLowerCase().pipe(z.email().max(30)),
  password: z.string().min(6),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(6),
});
