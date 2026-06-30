import { Router } from "express";
import { Role } from "@prisma/client";
import { SongController } from "../controllers/songController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const controller = new SongController();
const requireEditor = requireRole(Role.GLOBAL_ADMIN, Role.TENANT_ADMIN, Role.MINISTRY_LEADER);

router.use(authMiddleware);
router.get("/", (req, res) => controller.list(req, res));
router.get("/cifra-club/search", requireEditor, (req, res) => controller.searchCifraClub(req, res));
router.post("/cifra-club/import", requireEditor, (req, res) => controller.importCifraClub(req, res));
router.post("/export", (req, res) => controller.export(req, res));
router.get("/:id", (req, res) => controller.get(req, res));
router.post("/", requireEditor, (req, res) => controller.create(req, res));
router.patch("/:id", requireEditor, (req, res) => controller.update(req, res));

export default router;
