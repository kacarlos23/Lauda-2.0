import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { config } from "../config/unifiedConfig";
import { NotFoundError, UnauthorizedError, ValidationError } from "../errors/AppError";
import { AuthRepository } from "../repositories/authRepository";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  PublicMemberRegisterInput,
} from "../validators/auth.schema";

interface RefreshTokenPayload {
  id?: string;
  userId?: string;
  type: "refresh";
}

interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
}

const authRepository = new AuthRepository();
const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const INVITE_CODE_GROUP_LENGTH = 4;
const INVITE_CODE_CREATE_ATTEMPTS = 5;

type MemberInviteView = {
  id: string;
  code: string;
  active: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  ministryId?: string | null;
  ministry?: { id: string; name: string } | null;
};

function normalizeInviteCode(code: string): string {
  const trimmed = code.trim();
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export class AuthService {
  private buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    role: string;
    tenantId: string | null;
    tenant?: { id: string; name: string } | null;
    instruments?: Array<{ instrument: { id: string; name: string; colorHex: string | null } }>;
  }) {
    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
        tenantId: user.tenantId,
        instruments: user.instruments?.map((item) => item.instrument) ?? [],
      },
        tenant: user.tenant ?? null,
    };
  }

  /**
   * Registers a tenant and its first administrator.
   *
   * @param input Validated registration payload.
   * @returns Authentication payload with token pair and user data.
   */
  async register(input: RegisterInput) {
    const { churchName, name, email, password } = input;

    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ValidationError("E-mail já está em uso");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const tenant = await authRepository.createTenantWithAdmin({
      churchName,
      name,
      email,
      hashedPassword,
    });

    const user = tenant.users[0];
    const auth = this.buildAuthResponse({ ...user, tenantId: tenant.id });

    return {
      ...auth,
      tenant: { id: tenant.id, name: tenant.name },
    };
  }

  async registerPublicMember(input: PublicMemberRegisterInput) {
    const inviteCode = normalizeInviteCode(input.inviteCode);
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const phone = input.phone?.trim() || undefined;

    const invite = await authRepository.findActiveMemberInviteByCode(inviteCode);
    if (!invite) {
      throw new ValidationError("Convite inválido ou expirado");
    }

    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ValidationError("E-mail já está em uso");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await authRepository.createPublicMember({
      tenantId: invite.tenantId,
      name,
      email,
      phone,
      hashedPassword,
      ministryId: invite.ministryId,
    });

    return {
      ...this.buildAuthResponse(user),
      tenant: invite.tenant,
    };
  }

  /**
   * Authenticates a user and issues access and refresh tokens.
   *
   * @param input Validated login credentials.
   * @returns Authentication payload with token pair and user data.
   */
  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Usuário inativo");
    }

    if (input.inviteCode) {
      await this.applyInviteToExistingUser(input.inviteCode, user);
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Exchanges a valid refresh token for a new token pair.
   *
   * @param input Validated refresh-token payload.
   * @returns Authentication payload with renewed token pair and user data.
   */
  async refresh(input: RefreshTokenInput) {
    let decoded: RefreshTokenPayload;
    try {
      decoded = jwt.verify(
        input.refreshToken,
        config.auth.refreshJwtSecret
      ) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedError("Refresh token inválido");
    }

    if (decoded.type !== "refresh") {
      throw new UnauthorizedError("Refresh token inválido");
    }

    const refreshUserId = decoded.userId ?? decoded.id;
    if (!refreshUserId) {
      throw new UnauthorizedError("Refresh token inválido");
    }

    const user = await authRepository.findUserById(refreshUserId);
    if (!user) {
      throw new UnauthorizedError("Usuário não encontrado");
    }

    return this.buildAuthResponse(user);
  }

  async getMemberInvite(tenantId: string, ministryId?: string) {
    if (ministryId) {
      await this.ensureMinistryBelongsToTenant(tenantId, ministryId);
    }

    const invite = await authRepository.findCurrentMemberInvite(tenantId, ministryId);
    if (invite) return this.formatMemberInvite(invite);

    return this.formatMemberInvite(await this.createMemberInviteWithRetry(tenantId, ministryId));
  }

  async regenerateMemberInvite(tenantId: string, ministryId?: string) {
    if (ministryId) {
      await this.ensureMinistryBelongsToTenant(tenantId, ministryId);
    }

    await authRepository.deactivateMemberInvites(tenantId, ministryId);
    return this.formatMemberInvite(await this.createMemberInviteWithRetry(tenantId, ministryId));
  }

  /**
   * Requests a password reset. Generates a 6-digit PIN and simulates email sending.
   */
  async requestPasswordReset(input: ForgotPasswordInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      // Return generic success message to prevent email enumeration
      return { success: true, message: "Se o e-mail existir, um código foi enviado." };
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await authRepository.savePasswordResetToken(user.id, pin, expiresAt);

    console.log(`\n[EMAIL SIMULADO] ==========================`);
    console.log(`Para: ${user.email}`);
    console.log(`Assunto: Recuperação de Senha`);
    console.log(`Seu código PIN é: ${pin}`);
    console.log(`Válido por 15 minutos.`);
    console.log(`===========================================\n`);

    return { success: true, message: "Se o e-mail existir, um código foi enviado." };
  }

  /**
   * Resets the password using the provided PIN.
   */
  async resetPassword(input: ResetPasswordInput) {
    const { email, token, newPassword } = input;

    const user = await authRepository.findUserByResetToken(token);

    if (!user || user.email !== email || !user.resetPasswordExpires) {
      throw new ValidationError("PIN inválido ou expirado.");
    }

    if (new Date() > user.resetPasswordExpires) {
      throw new ValidationError("PIN expirado. Solicite um novo código.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await authRepository.updatePassword(user.id, hashedPassword);

    return { success: true, message: "Senha atualizada com sucesso." };
  }

  private generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(
      payload,
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: "refresh" },
      config.auth.refreshJwtSecret,
      { expiresIn: config.auth.refreshJwtExpiresIn } as jwt.SignOptions
    );
  }

  private generateInviteCode(): string {
    const generateGroup = () => Array.from(
      { length: INVITE_CODE_GROUP_LENGTH },
      () => INVITE_CODE_ALPHABET[crypto.randomInt(INVITE_CODE_ALPHABET.length)]
    ).join("");

    return `${generateGroup()}-${generateGroup()}`;
  }

  private async createMemberInviteWithRetry(tenantId: string, ministryId?: string): Promise<MemberInviteView> {
    for (let attempt = 1; attempt <= INVITE_CODE_CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await authRepository.createMemberInvite(tenantId, this.generateInviteCode(), ministryId);
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new ValidationError("Não foi possível gerar um convite único. Tente novamente.");
  }

  private formatMemberInvite(invite: MemberInviteView) {
    const code = invite.code;
    const baseUrl = config.memberInviteBaseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";

    return {
      id: invite.id,
      code,
      active: invite.active,
      expiresAt: invite.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
      createdAt: new Date(invite.createdAt).toISOString(),
      ministryId: invite.ministryId ?? null,
      ministry: invite.ministry ?? null,
      inviteLink: `${baseUrl}${separator}code=${encodeURIComponent(code)}`,
    };
  }

  private async ensureMinistryBelongsToTenant(tenantId: string, ministryId: string) {
    const ministry = await authRepository.findMinistryById(tenantId, ministryId);
    if (!ministry) {
      throw new ValidationError("Ministério não encontrado");
    }

    return ministry;
  }

  private async applyInviteToExistingUser(inviteCode: string, user: { id: string; tenantId: string | null }) {
    const invite = await authRepository.findActiveMemberInviteByCode(normalizeInviteCode(inviteCode));
    if (!invite) {
      throw new ValidationError("Convite inválido ou expirado");
    }

    if (!user.tenantId || invite.tenantId !== user.tenantId) {
      throw new ValidationError("Convite inválido para este usuário");
    }

    if (invite.ministryId) {
      const membership = await authRepository.addUserToMinistry({
        tenantId: user.tenantId,
        userId: user.id,
        ministryId: invite.ministryId,
      });
      if (!membership) {
        throw new ValidationError("Convite inválido para este usuário");
      }
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
