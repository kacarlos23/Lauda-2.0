import { Router } from "express";
import { Role } from "@prisma/client";
import { ArtistController } from "../controllers/artistController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const controller = new ArtistController();
const requireEditor = requireRole(Role.GLOBAL_ADMIN, Role.TENANT_ADMIN, Role.MINISTRY_LEADER);

router.use(authMiddleware);
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.get(req, res));
router.post("/", requireEditor, (req, res) => controller.create(req, res));
router.patch("/:id", requireEditor, (req, res) => controller.update(req, res));

export default router;
