import { prisma } from "./prismaClient";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { WorshipOrderInput } from "../validators/worshipOrder.schema";
import { scheduleSongsChanged } from "../security/scheduleMutationPolicy";
import { enqueueScheduleUpdated, loadScheduleNotificationSnapshot } from "../services/scheduleNotificationService";

const active = { isActive: true, deletedAt: null };
const scheduleInclude = (tenantId: string) => ({
  songs: { where: { ...active, tenantId, song: { ...active, tenantId, artist: { ...active, tenantId } } }, orderBy: { order: "asc" as const }, include: { song: { select: {
    id: true, title: true, videoUrl: true, originalKey: true, bpm: true, artistId: true,
    artist: { select: { id: true, name: true, imageUrl: true } },
  } } } },
});

export class WorshipOrderRepository {
  constructor(private readonly tenantId: string) {}

  async find(date: string) {
    const order = await prisma.worshipOrder.findFirst({
      where: { tenantId: this.tenantId, date },
    });
    if (!order) return null;
    // Resolve each reference with tenant and active filters, including after cancellation.
    const load = (id: string | null) => id ? prisma.schedule.findFirst({
      where: { id, tenantId: this.tenantId, ...active }, include: scheduleInclude(this.tenantId),
    }) : null;
    const [morning, evening, tenant] = await Promise.all([
      load(order.morningScheduleId), load(order.eveningScheduleId),
      prisma.tenant.findUnique({ where: { id: this.tenantId }, select: { name: true } }),
    ]);
    return { date, updatedAt: order.updatedAt, churchName: tenant?.name ?? null, morning, evening };
  }

  async save(date: string, input: WorshipOrderInput, actorId: string, canModifySongs: boolean) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const period of [input.morning, input.evening]) {
          if (!period) continue;
          const schedule = await tx.schedule.findFirst({
            where: { id: period.scheduleId, tenantId: this.tenantId, ...active }, include: scheduleInclude(this.tenantId),
          });
          if (!schedule) throw new NotFoundError("Escala não encontrada nesta igreja");
          const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(schedule.date);
          if (day !== date) throw new ValidationError("A escala deve pertencer à data do culto");
          if (!canModifySongs && scheduleSongsChanged(schedule.songs.map((entry) => entry.songId), period.songs.map((entry) => entry.songId))) {
            throw new ForbiddenError("Sem permissão para alterar músicas da escala");
          }
          const ids = period.songs.map((entry) => entry.songId);
          const count = await tx.song.count({ where: { id: { in: ids }, tenantId: this.tenantId, ...active, artist: { tenantId: this.tenantId, ...active } } });
          if (count !== ids.length) throw new NotFoundError("Uma ou mais músicas não estão disponíveis nesta igreja");
          const before = await loadScheduleNotificationSnapshot(this.tenantId, schedule.id, tx);
          await tx.scheduleSong.deleteMany({ where: { tenantId: this.tenantId, scheduleId: schedule.id, songId: { notIn: ids } } });
          for (const [order, entry] of period.songs.entries()) {
            const data = { order, moment: entry.moment, momentDescription: entry.moment === "Outro" ? entry.momentDescription || null : null,
              videoUrlOverride: entry.videoUrlOverride || null, isActive: true, deletedAt: null };
            await tx.scheduleSong.upsert({
              where: { scheduleId_songId: { scheduleId: schedule.id, songId: entry.songId }, tenantId: this.tenantId },
              create: { ...data, tenantId: this.tenantId, scheduleId: schedule.id, songId: entry.songId }, update: data,
            });
          }
          await tx.schedule.update({ where: { id: schedule.id, tenantId: this.tenantId }, data: { updatedAt: new Date() } });
          const after = await loadScheduleNotificationSnapshot(this.tenantId, schedule.id, tx);
          if (before && after) await enqueueScheduleUpdated(tx, before, after, actorId);
        }
        const data = { morningScheduleId: input.morning?.scheduleId ?? null, eveningScheduleId: input.evening?.scheduleId ?? null };
        await tx.worshipOrder.upsert({
          where: { tenantId_date: { tenantId: this.tenantId, date } },
          create: { tenantId: this.tenantId, date, ...data }, update: data,
        });
      }, { isolationLevel: "Serializable", timeout: 20000 });
    } catch (error) {
      if ((error as { code?: string }).code === "P2034") throw new ConflictError("A escala foi alterada simultaneamente. Recarregue e tente novamente.");
      throw error;
    }
    return this.find(date);
  }
}
