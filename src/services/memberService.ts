import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { MemberRepository } from "../repositories/MemberRepository";
import { CreateMemberInput, UpdateMemberInstrumentsInput } from "../validators/member.schema";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";

type RequestUser = {
  id: string;
  role: Role;
};

export class MemberService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async listAll() {
    return this.memberRepository.findAll();
  }

  async getById(id: string) {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }
    return member;
  }

  async create(input: CreateMemberInput) {
    const existing = await this.memberRepository.findByEmail(input.email);
    if (existing) {
      throw new ValidationError("Já existe um usuário com este e-mail");
    }
    const password = await bcrypt.hash(input.password, 10);
    return this.memberRepository.create({ ...input, password });
  }

  async addMinistry(memberId: string, ministryId: string, isLeader: boolean) {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }

    const ministry = await this.memberRepository.findMinistryById(ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado");
    }

    return this.memberRepository.addMinistry(memberId, ministryId, isLeader);
  }

  async updateInstruments(memberId: string, input: UpdateMemberInstrumentsInput, user: RequestUser) {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }

    const isSelf = user.id === memberId;
    const isAdmin = user.role === Role.GLOBAL_ADMIN || user.role === Role.TENANT_ADMIN;
    if (!isSelf && !isAdmin) {
      throw new ForbiddenError("Apenas o próprio membro ou administradores podem alterar instrumentos");
    }

    const instrumentIds = Array.from(new Set(input.instrumentIds));
    if (instrumentIds.length > 0) {
      const found = await this.memberRepository.findInstrumentIds(instrumentIds);
      if (found.length !== instrumentIds.length) {
        throw new ValidationError("Instrumento inválido ou não encontrado");
      }
    }

    const instruments = await this.memberRepository.replaceInstruments(memberId, instrumentIds);
    return { id: memberId, instruments };
  }
}
