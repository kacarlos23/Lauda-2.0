import bcrypt from "bcryptjs";
import { MemberRepository } from "../repositories/MemberRepository";
import { CreateMemberInput } from "../validators/member.schema";

export class MemberService {
  constructor(private readonly memberRepository: MemberRepository) {}

  async listAll() {
    return this.memberRepository.findAll();
  }

  async getById(id: string) {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new Error("Membro não encontrado");
    }
    return member;
  }

  async create(input: CreateMemberInput) {
    const existing = await this.memberRepository.findByEmail(input.email);
    if (existing) {
      throw new Error("Já existe um usuário com este e-mail");
    }
    const password = await bcrypt.hash(input.password, 10);
    return this.memberRepository.create({ ...input, password });
  }

  async addToMinistry(userId: string, ministryId: string, isLeader = false) {
    await this.getById(userId); // validates member belongs to same tenant
    return this.memberRepository.addToMinistry(userId, ministryId, isLeader);
  }

  async removeFromMinistry(userId: string, ministryId: string) {
    return this.memberRepository.removeFromMinistry(userId, ministryId);
  }
}
