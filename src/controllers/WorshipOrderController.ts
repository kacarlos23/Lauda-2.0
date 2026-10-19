import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { WorshipOrderRepository } from "../repositories/WorshipOrderRepository";
import { worshipDateSchema, worshipOrderSchema } from "../validators/worshipOrder.schema";
import { WorshipOrderPdfService } from "../services/worshipOrderPdfService";
import { hasPermission } from "../services/permissionService";
import { ValidationError } from "../errors/AppError";

export class WorshipOrderController extends BaseController {
  async get(req: Request, res: Response) {
    const date = worshipDateSchema.parse(req.params.date);
    this.handleSuccess(res, await new WorshipOrderRepository(req.user!.tenantId).find(date));
  }

  async save(req: Request, res: Response) {
    const date = worshipDateSchema.parse(req.params.date);
    const input = worshipOrderSchema.parse(req.body);
    const canModifySongs = await hasPermission(req.user!, "song:attach_to_schedule", req.user!.tenantId);
    this.handleSuccess(res, await new WorshipOrderRepository(req.user!.tenantId).save(date, input, req.user!.id, canModifySongs));
  }

  async export(req: Request, res: Response) {
    const date = worshipDateSchema.parse(req.params.date);
    const order = await new WorshipOrderRepository(req.user!.tenantId).find(date);
    if (!order || (!order.morning?.songs.length && !order.evening?.songs.length)) throw new ValidationError("Salve uma ordem com ao menos uma música antes de exportar");
    const pdf = await new WorshipOrderPdfService().generate(order);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="Ordem_de_Culto_${date.split("-").reverse().join("-")}.pdf"`);
    res.send(pdf);
  }
}
