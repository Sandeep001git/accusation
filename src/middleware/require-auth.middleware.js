// Verify the session cookie and load the current account's trusted role.
import { jwtToken } from "#utils/jwt.js";
import { eq } from "drizzle-orm";
import { db } from "#config/database.js";
import { users } from "#models/user.model.js";

const requireAuth = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let payload;
  try {
    payload = jwtToken.verify(token);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!payload || typeof payload !== "object") {
    return res.status(401).json({ error: "Authentication required" });
  }
  const id = Number(payload.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireAuth;
