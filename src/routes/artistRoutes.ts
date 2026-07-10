import { Router } from "express";
import { ArtistController } from "../controllers/artistController";
import { authMiddleware, requirePermission } from "../middlewares/authMiddleware";

const router = Router();
const controller = new ArtistController();

router.use(authMiddleware);
router.get("/", requirePermission("song:view"), (req, res) => controller.list(req, res));
router.get("/:id", requirePermission("song:view"), (req, res) => controller.get(req, res));
router.post("/", requirePermission("song:create"), (req, res) => controller.create(req, res));
router.patch("/:id", requirePermission("song:edit"), (req, res) => controller.update(req, res));

export default router;
