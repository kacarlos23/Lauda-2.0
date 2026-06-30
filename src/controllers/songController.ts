import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ArtistRepository } from "../repositories/artistRepository";
import { SongRepository } from "../repositories/songRepository";
import { SongPdfService } from "../services/songPdfService";
import { SongService } from "../services/songService";
import { CifraClubImportService } from "../services/cifraClubImportService";
import { cifraClubImportSchema, cifraClubSearchSchema, createSongSchema, exportSongsSchema, songIdSchema, songListSchema, updateSongSchema } from "../validators/song.schema";

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
      console.error(`[SongPdf] Falha ao gerar PDF para ${songIds.length} música(s)`, error);
      throw error;
    }
  }
}
