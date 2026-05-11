import bcrypt from "bcryptjs";
import { MemberRepository } from "../repositories/MemberRepository";
import { CreateMemberInput } from "../validators/member.schema";
import { NotFoundError, ValidationError } from "../errors/AppError";

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
      throw new NotFoundError("Membro nÃ£o encontrado");
    }

    const ministry = await this.memberRepository.findMinistryById(ministryId);
    if (!ministry) {
      throw new NotFoundError("MinistÃ©rio nÃ£o encontrado");
    }

    return this.memberRepository.addMinistry(memberId, ministryId, isLeader);
  }
}
