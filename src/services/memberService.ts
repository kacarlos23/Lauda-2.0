import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { MemberRepository } from "../repositories/MemberRepository";
import { CreateMemberInput, UpdateMemberInstrumentsInput, UpdateMemberPermissionsInput, UpdateMyProfileInput } from "../validators/member.schema";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { hasPermission } from "./permissionService";

type RequestUser = {
  id: string;
  role: Role;
  tenantId?: string;
};

export class MemberService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async listAll() {
    return this.memberRepository.findAll();
  }

  async getById(id: string) {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new NotFoundError("Membro não encontrado.");
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

  async updateMyProfile(userId: string, input: UpdateMyProfileInput) {
    const member = await this.memberRepository.updateProfile(userId, {
      ...input,
      phone: input.phone === "" ? null : input.phone,
    });
    if (!member) throw new NotFoundError("Membro não encontrado");
    return member;
  }

  async addMinistry(memberId: string, ministryId: string, isLeader: boolean) {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado.");
    }

    const ministry = await this.memberRepository.findMinistryById(ministryId);
    if (!ministry) {
      throw new NotFoundError("Ministério não encontrado.");
    }

    const assignment = await this.memberRepository.addMinistry(memberId, ministryId, isLeader);
    if (!assignment) {
      throw new NotFoundError("Membro ou ministério não encontrado");
    }
    return assignment;
  }

  async updateInstruments(memberId: string, input: UpdateMemberInstrumentsInput, user: RequestUser) {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }

    const isSelf = user.id === memberId;
    const canEditMembers = await hasPermission(user, "member:edit", user.tenantId);
    if (!isSelf && !canEditMembers) {
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
    if (!instruments) {
      throw new NotFoundError("Membro não encontrado");
    }
    return { id: memberId, instruments };
  }

  async updatePermissions(memberId: string, input: UpdateMemberPermissionsInput, user: RequestUser) {
    const member = await this.memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError("Membro não encontrado");
    }

    if (memberId === user.id) {
      throw new ForbiddenError("Administradores não podem alterar as próprias permissões");
    }

    if (member.role === Role.GLOBAL_ADMIN) {
      throw new ForbiddenError("Não é permitido alterar permissões de administrador global");
    }

    const canManageLegacyPermissions = user.role === Role.GLOBAL_ADMIN || user.role === Role.TENANT_ADMIN;
    if (!canManageLegacyPermissions) {
      throw new ForbiddenError("Apenas administradores podem alterar permissões");
    }

    const normalizedMinistries = Array.from(
      new Map(input.ministries.map((item) => [item.ministryId, item])).values()
    );

    if (normalizedMinistries.length > 0) {
      const ministryIds = normalizedMinistries.map((item) => item.ministryId);
      const found = await this.memberRepository.findMinistryIds(ministryIds);
      if (found.length !== ministryIds.length) {
        throw new ValidationError("Ministério inválido ou não encontrado");
      }
    }

    const shouldBeLeader = input.role === Role.MINISTRY_LEADER || normalizedMinistries.some((item) => item.isLeader);
    const role = shouldBeLeader && input.role === Role.MEMBER ? Role.MINISTRY_LEADER : input.role;

    const updated = await this.memberRepository.updatePermissions(memberId, {
      role,
      ministries: normalizedMinistries,
    });
    if (!updated) {
      throw new NotFoundError("Membro não encontrado");
    }
    return updated;
  }
}
