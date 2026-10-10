// Define public signup and authenticated self-service/admin user endpoints.
import express from "express";
import securityMiddleware from "#middleware/security.middleware.js";
import requireAuth from "#middleware/require-auth.middleware.js";
import {
  create,
  list,
  read,
  readMe,
  remove,
  removeMe,
  update,
  updateMe,
} from "#controllers/user.controller.js";

const router = express.Router();

router.post("/", securityMiddleware, create);
router.use(requireAuth, securityMiddleware);
router.get("/me", readMe);
router.patch("/me", updateMe);
router.delete("/me", removeMe);
router.get("/", list);
router.get("/:id", read);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
