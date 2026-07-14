import { Router } from "express";
import { SongController } from "../controllers/songController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const controller = new SongController();

router.use(authMiddleware);
router.get("/", requirePermission("song:view"), (req, res) => controller.list(req, res));
router.get("/cifra-club/search", requirePermission("song:create"), (req, res) => controller.searchCifraClub(req, res));
router.post("/cifra-club/import", requirePermission("song:create"), (req, res) => controller.importCifraClub(req, res));
router.post("/export", requirePermission("song:view"), (req, res) => controller.export(req, res));
router.get("/:id", requirePermission("song:view"), (req, res) => controller.get(req, res));
router.post("/", requirePermission("song:create"), (req, res) => controller.create(req, res));
router.patch("/:id", requirePermission("song:edit"), (req, res) => controller.update(req, res));
router.delete("/:id", requirePermission("song:delete"), (req, res) => controller.delete(req, res));

export default router;
