import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminController } from "../controllers/AdminController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();
const ctrl = new AdminController();

router.use(authMiddleware);
router.use(requireRole(Role.GLOBAL_ADMIN));

router.get("/tenants", (req, res) => ctrl.listTenants(req, res));
router.get("/tenants/:tenantId", (req, res) => ctrl.getTenant(req, res));
router.patch("/tenants/:tenantId", (req, res) => ctrl.updateTenant(req, res));
router.get("/users", (req, res) => ctrl.listUsers(req, res));
router.patch("/users/:userId", (req, res) => ctrl.updateUser(req, res));
router.get("/permissions", (req, res) => ctrl.listPermissions(req, res));
router.get("/users/:userId/permissions", (req, res) => ctrl.listUserPermissions(req, res));
router.post("/users/:userId/permissions", (req, res) => ctrl.grantUserPermission(req, res));
router.put("/users/:userId/permissions", (req, res) => ctrl.setUserPermissions(req, res));
router.delete("/users/:userId/permissions", (req, res) => ctrl.revokeUserPermission(req, res));
router.get("/ministries", (req, res) => ctrl.listMinistries(req, res));
router.get("/songs", (req, res) => ctrl.listSongs(req, res));
router.patch("/songs/:songId", (req, res) => ctrl.updateSong(req, res));
router.get("/schedules", (req, res) => ctrl.listSchedules(req, res));
router.patch("/schedules/:scheduleId", (req, res) => ctrl.updateSchedule(req, res));
router.get("/resources", (req, res) => ctrl.listResources(req, res));
router.get("/:resource", (req, res) => ctrl.listResource(req, res));
router.post("/:resource", (req, res) => ctrl.createResource(req, res));
router.get("/:resource/:id", (req, res) => ctrl.getResource(req, res));
router.patch("/:resource/:id", (req, res) => ctrl.updateResource(req, res));
router.post("/:resource/:id/activate", (req, res) => ctrl.activateResource(req, res));
router.post("/:resource/:id/deactivate", (req, res) => ctrl.deactivateResource(req, res));
router.delete("/:resource/:id", (req, res) => ctrl.deleteResource(req, res));

export default router;
