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
  tenantId: string;
}

const authRepository = new AuthRepository();
const INVITE_CODE_BYTES = 24;
const INVITE_CODE_CREATE_ATTEMPTS = 5;

type MemberInviteView = {
  id: string;
  code: string;
  active: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
};

export class AuthService {
  private buildAuthResponse(user: { id: string; name: string; email: string; role: string; tenantId: string }) {
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
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
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
      throw new ValidationError("E-mail ja esta em uso");
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
    const inviteCode = input.inviteCode.trim();
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const phone = input.phone?.trim() || undefined;

    const invite = await authRepository.findActiveMemberInviteByCode(inviteCode);
    if (!invite) {
      throw new ValidationError("Convite invalido ou expirado");
    }

    const existing = await authRepository.findUserByEmail(email);
    if (existing) {
      throw new ValidationError("E-mail ja esta em uso");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await authRepository.createPublicMember({
      tenantId: invite.tenantId,
      name,
      email,
      phone,
      hashedPassword,
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
      throw new NotFoundError("Usuario nao encontrado");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciais invalidas");
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
      throw new UnauthorizedError("Refresh token invalido");
    }

    if (decoded.type !== "refresh") {
      throw new UnauthorizedError("Refresh token invalido");
    }

    const refreshUserId = decoded.userId ?? decoded.id;
    if (!refreshUserId) {
      throw new UnauthorizedError("Refresh token invalido");
    }

    const user = await authRepository.findUserById(refreshUserId);
    if (!user) {
      throw new UnauthorizedError("Usuario nao encontrado");
    }

    return this.buildAuthResponse(user);
  }

  async getMemberInvite(tenantId: string) {
    const invite = await authRepository.findCurrentMemberInvite(tenantId);
    if (invite) return this.formatMemberInvite(invite);

    return this.formatMemberInvite(await this.createMemberInviteWithRetry(tenantId));
  }

  async regenerateMemberInvite(tenantId: string) {
    await authRepository.deactivateMemberInvites(tenantId);
    return this.formatMemberInvite(await this.createMemberInviteWithRetry(tenantId));
  }

  /**
   * Requests a password reset. Generates a 6-digit PIN and simulates email sending.
   */
  async requestPasswordReset(input: ForgotPasswordInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      // Return generic success message to prevent email enumeration
      return { success: true, message: "Se o e-mail existir, um codigo foi enviado." };
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await authRepository.savePasswordResetToken(user.id, pin, expiresAt);

    console.log(`\n[EMAIL SIMULADO] ==========================`);
    console.log(`Para: ${user.email}`);
    console.log(`Assunto: Recuperacao de Senha`);
    console.log(`Seu codigo PIN e: ${pin}`);
    console.log(`Valido por 15 minutos.`);
    console.log(`===========================================\n`);

    return { success: true, message: "Se o e-mail existir, um codigo foi enviado." };
  }

  /**
   * Resets the password using the provided PIN.
   */
  async resetPassword(input: ResetPasswordInput) {
    const { email, token, newPassword } = input;

    const user = await authRepository.findUserByResetToken(token);

    if (!user || user.email !== email || !user.resetPasswordExpires) {
      throw new ValidationError("PIN invalido ou expirado.");
    }

    if (new Date() > user.resetPasswordExpires) {
      throw new ValidationError("PIN expirado. Solicite um novo codigo.");
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
    return crypto.randomBytes(INVITE_CODE_BYTES).toString("base64url");
  }

  private async createMemberInviteWithRetry(tenantId: string): Promise<MemberInviteView> {
    for (let attempt = 1; attempt <= INVITE_CODE_CREATE_ATTEMPTS; attempt += 1) {
      try {
        return await authRepository.createMemberInvite(tenantId, this.generateInviteCode());
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new ValidationError("Nao foi possivel gerar um convite unico. Tente novamente.");
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
      inviteLink: `${baseUrl}${separator}code=${encodeURIComponent(code)}`,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
