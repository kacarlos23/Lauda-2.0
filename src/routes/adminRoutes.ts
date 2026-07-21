import { Router } from "express";
import { Role } from "@prisma/client";
import { AdminController } from "../controllers/AdminController";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { requireRecentStepUp } from "../middlewares/authMiddleware";
import { PrivilegedAccessController } from "../controllers/PrivilegedAccessController";

const router = Router();
const ctrl = new AdminController();
const privilegedCtrl = new PrivilegedAccessController();

router.use(authMiddleware);
router.use(requireRole(Role.GLOBAL_ADMIN));

router.get("/tenants", (req, res) => ctrl.listTenants(req, res));
router.get("/tenants/:tenantId", (req, res) => ctrl.getTenant(req, res));
router.patch("/tenants/:tenantId", requireRecentStepUp, (req, res) => ctrl.updateTenant(req, res));
router.get("/users", (req, res) => ctrl.listUsers(req, res));
router.patch("/users/:userId", requireRecentStepUp, (req, res) => ctrl.updateUser(req, res));
router.get("/permissions", (req, res) => ctrl.listPermissions(req, res));
router.get("/users/:userId/permissions", (req, res) => ctrl.listUserPermissions(req, res));
router.post("/users/:userId/permissions", requireRecentStepUp, (req, res) => ctrl.grantUserPermission(req, res));
router.put("/users/:userId/permissions", requireRecentStepUp, (req, res) => ctrl.setUserPermissions(req, res));
router.delete("/users/:userId/permissions", requireRecentStepUp, (req, res) => ctrl.revokeUserPermission(req, res));
router.get("/support-access-grants", requireRecentStepUp, (req, res) => privilegedCtrl.listGrants(req, res));
router.post("/support-access-grants", requireRecentStepUp, (req, res) => privilegedCtrl.createGrant(req, res));
router.delete("/support-access-grants/:grantId", requireRecentStepUp, (req, res) => privilegedCtrl.revokeGrant(req, res));
router.get("/ministries", (req, res) => ctrl.listMinistries(req, res));
router.get("/songs", (req, res) => ctrl.listSongs(req, res));
router.patch("/songs/:songId", requireRecentStepUp, (req, res) => ctrl.updateSong(req, res));
router.get("/schedules", (req, res) => ctrl.listSchedules(req, res));
router.patch("/schedules/:scheduleId", requireRecentStepUp, (req, res) => ctrl.updateSchedule(req, res));
router.get("/resources", (req, res) => ctrl.listResources(req, res));
router.get("/:resource", (req, res) => ctrl.listResource(req, res));
router.post("/:resource", requireRecentStepUp, (req, res) => ctrl.createResource(req, res));
router.get("/:resource/:id", (req, res) => ctrl.getResource(req, res));
router.patch("/:resource/:id", requireRecentStepUp, (req, res) => ctrl.updateResource(req, res));
router.post("/:resource/:id/activate", requireRecentStepUp, (req, res) => ctrl.activateResource(req, res));
router.post("/:resource/:id/deactivate", requireRecentStepUp, (req, res) => ctrl.deactivateResource(req, res));
router.delete("/:resource/:id", requireRecentStepUp, (req, res) => ctrl.deleteResource(req, res));

export default router;
