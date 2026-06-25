import { Request, Response } from "express";
import { BaseController } from "./BaseController";
import { ArtistRepository } from "../repositories/artistRepository";
import { ArtistService } from "../services/artistService";
import { artistIdSchema, artistListSchema, createArtistSchema, updateArtistSchema } from "../validators/artist.schema";

export class ArtistController extends BaseController {
  private service(req: Request) {
    return new ArtistService(new ArtistRepository(req.user!.tenantId));
  }

  async list(req: Request, res: Response) {
    this.handleSuccess(res, await this.service(req).list(artistListSchema.parse(req.query)));
  }

  async get(req: Request, res: Response) {
    const { id } = artistIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service(req).get(id));
  }

  async create(req: Request, res: Response) {
    this.handleSuccess(res, await this.service(req).create(createArtistSchema.parse(req.body)), 201);
  }

  async update(req: Request, res: Response) {
    const { id } = artistIdSchema.parse(req.params);
    this.handleSuccess(res, await this.service(req).update(id, updateArtistSchema.parse(req.body)));
  }
}
