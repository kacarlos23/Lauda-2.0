import { Router } from "express";
import { MinistryController } from "../controllers/MinistryController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new MinistryController();

// All ministry routes require authentication
router.use(authMiddleware);

router.get("/", (req, res) => ctrl.list(req, res));
router.get("/:id", (req, res) => ctrl.getOne(req, res));
router.post("/", (req, res) => ctrl.create(req, res));
router.put("/:id", (req, res) => ctrl.update(req, res));
router.delete("/:id", (req, res) => ctrl.remove(req, res));

export default router;
