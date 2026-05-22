import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { InstrumentController } from "../controllers/InstrumentController";
import { ForbiddenError } from "../errors/AppError";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new InstrumentController();

router.use(authMiddleware);

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role === Role.TENANT_ADMIN || role === Role.GLOBAL_ADMIN) return next();
  next(new ForbiddenError("Acesso negado: apenas administradores"));
}

router.get("/", (req, res) => ctrl.list(req, res));
router.post("/", requireAdmin, (req, res) => ctrl.create(req, res));
router.patch("/:id", requireAdmin, (req, res) => ctrl.update(req, res));
router.delete("/:id", requireAdmin, (req, res) => ctrl.delete(req, res));

export default router;
