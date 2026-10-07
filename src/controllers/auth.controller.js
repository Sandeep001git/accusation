import { logger } from "#config/logger.js";
import { signInSchema, signUpSchema } from "#validations/auth.validation.js";
import { formatValidationErrors } from "#utils/format.js";
import { authenticateUser, createUser } from "#services/auth.service.js";
import { jwtToken } from "#utils/jwt.js";
import { cookie } from "#utils/cookies.js";

export const signUp = async (req, res, next) => {
  try {
    const validationResult = signUpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        errors: "Validation failed",
        details: formatValidationErrors(validationResult.error),
      });
    }
    const { name, email, password } = validationResult.data;
    const user = await createUser({ name, email, password });

    const token = jwtToken.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    cookie.set(res, "token", token);

    logger.info("User signed up successfully", {
      id: user.id,
      name,
      email,
      role: user.role,
    });
    res.status(201).json({
      message: "User signed up successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error("Error occurred while signing up user", error);

    if (error.message === "User with this email already exists") {
      return res.status(409).json({ error: "Email already exists" });
    }
    next(error);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const validationResult = signInSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        errors: "Validation failed",
        details: formatValidationErrors(validationResult.error),
      });
    }

    const user = await authenticateUser(validationResult.data);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwtToken.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    cookie.set(res, "token", token);

    logger.info("User signed in successfully", {
      id: user.id,
      email: user.email,
    });
    return res.status(200).json({
      message: "User signed in successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error("Error occurred while signing in user", error);
    return next(error);
  }
};

export const signOut = (req, res) => {
  cookie.clear(res, "token");
  return res.status(200).json({ message: "User signed out successfully" });
};
