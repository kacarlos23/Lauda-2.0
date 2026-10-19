import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ArtistRepository } from "../repositories/artistRepository";
import { SongRepository } from "../repositories/songRepository";
import { SongPdfService } from "../services/songPdfService";
import { logger } from "../observability/logger";
import { SongService } from "../services/songService";
import { CifraClubImportService } from "../services/cifraClubImportService";
import { cifraClubImportSchema, cifraClubSearchSchema, createSongSchema, exportSongsSchema, songIdSchema, songListSchema, updateSongSchema } from "../validators/song.schema";
import { SongTransferService } from "../services/songTransferService";
import { songTransferCommitSchema, songTransferExportSchema, songTransferPreviewSchema } from "../validators/songTransfer.schema";

function safeFilename(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9 -]/g, "").replace(/\s+/g, " ").trim();
}

export class SongController extends BaseController {
  private service(req: Request) {
    return new SongService(
      new SongRepository(req.user!.tenantId),
      new ArtistRepository(req.user!.tenantId),
      req.user!.id
    );
  }

  async list(req: Request, res: Response) {
    this.handleSuccess(res, await this.service(req).list(songListSchema.parse(req.query)));
  }

  async get(req: Request, res: Response) {
    const { id } = songIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service(req).get(id));
  }

  async create(req: Request, res: Response) {
    this.handleSuccess(res, await this.service(req).create(createSongSchema.parse(req.body)), 201);
  }

  async searchCifraClub(req: Request, res: Response) {
    this.handleSuccess(res, await new CifraClubImportService().search(cifraClubSearchSchema.parse(req.query)));
  }

  async importCifraClub(req: Request, res: Response) {
    const { url } = cifraClubImportSchema.parse(req.body);
    this.handleSuccess(res, await new CifraClubImportService().import(url));
  }

  async update(req: Request, res: Response) {
    const { id } = songIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service(req).update(id, updateSongSchema.parse(req.body)));
  }

  async delete(req: Request, res: Response) {
    const { id } = songIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service(req).delete(id));
  }

  async export(req: Request, res: Response) {
    const { songIds, transpositions = {} } = exportSongsSchema.parse(req.body);
    const songs = await this.service(req).getForExport(songIds);
    try {
      const pdf = await new SongPdfService().generate(songs.map((song) => ({
        ...song,
        semitoneOffset: transpositions[song.id] ?? 0,
      })));
      const filename = songs.length === 1
        ? `${safeFilename(songs[0].artist.name)} - ${safeFilename(songs[0].title)}.pdf`
        : `Cifras - ${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(pdf);
    } catch (error) {
      logger.error("song_pdf_generation_failed", {
        category: "observability",
        component: "song-pdf",
        errorName: error instanceof Error ? error.name : "UnknownError",
        outcome: "error",
      });
      throw error;
    }
  }

  async exportData(req: Request, res: Response) {
    const document = await new SongTransferService(req.user!).export(songTransferExportSchema.parse(req.body));
    const filename = `lauda-musicas-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(document, null, 2));
  }

  async previewDataImport(req: Request, res: Response) {
    const input = songTransferPreviewSchema.parse(req.body);
    this.handleSuccess(res, await new SongTransferService(req.user!).preview(input));
  }

  async commitDataImport(req: Request, res: Response) {
    const input = songTransferCommitSchema.parse(req.body);
    const result = await new SongTransferService(req.user!).commit(input);
    logger.info("song_catalog_import_completed", {
      category: "audit",
      component: "song-transfer",
      actorId: req.user!.id,
      tenantId: req.user!.tenantId,
      ministryId: input.ministryId,
      created: result.created,
      linked: result.linked,
      restored: result.restored,
      conflicts: result.conflicts,
      invalid: result.invalid,
      outcome: "success",
    });
    this.handleSuccess(res, result, 201);
  }
}
