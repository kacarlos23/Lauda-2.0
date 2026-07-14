import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { MemberRepository } from "../repositories/MemberRepository";
import { CreateMemberInput, UpdateMemberInput, UpdateMemberInstrumentsInput, UpdateMemberPermissionsInput, UpdateMyProfileInput } from "../validators/member.schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { hasPermission } from "./permissionService";

type RequestUser = {
  id: string;
  role: Role;
  tenantId?: string;
  permissions?: string[];
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

  async update(memberId: string, input: UpdateMemberInput, user: RequestUser) {
    await this.ensureManageableMember(memberId, user);
    if (input.email) {
      const existing = await this.memberRepository.findByEmail(input.email.toLowerCase());
      if (existing && existing.id !== memberId) throw new ConflictError("E-mail já está em uso");
    }
    const member = await this.memberRepository.updateMember(memberId, input);
    if (!member) throw new NotFoundError("Membro não encontrado");
    return member;
  }

  async remove(memberId: string, user: RequestUser) {
    await this.ensureManageableMember(memberId, user);
    const count = await this.memberRepository.deactivateMember(memberId);
    if (!count) throw new NotFoundError("Membro não encontrado");
    return { id: memberId, isActive: false, message: "Membro inativado com sucesso" };
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

    const canManageLegacyPermissions = await hasPermission(user, "member:manage_access", user.tenantId);
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

  private async ensureManageableMember(memberId: string, user: RequestUser) {
    if (memberId === user.id) throw new ForbiddenError("Usuário não pode alterar ou inativar a própria conta por esta rota");
    const member = await this.memberRepository.findById(memberId);
    if (!member) throw new NotFoundError("Membro não encontrado");
    if (member.role === Role.GLOBAL_ADMIN) throw new ForbiddenError("Administrador global não pode ser alterado por esta rota");
    return member;
  }
}
