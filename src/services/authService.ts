import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
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

export class AuthService {
  private buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
    tenant: { id: string; name: string };
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
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
      tenant: user.tenant,
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
    return this.buildAuthResponse({
      ...user,
      tenantId: tenant.id,
      tenant: { id: tenant.id, name: tenant.name },
    });
  }

  async registerPublicMember(input: PublicMemberRegisterInput) {
    const invite = await authRepository.findActiveMemberInviteByCode(input.inviteCode);
    if (!invite) {
      throw new ValidationError("Convite inválido ou expirado");
    }

    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ValidationError("E-mail já está em uso");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await authRepository.createPublicMember({
      tenantId: invite.tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      hashedPassword,
    });

    return {
      ...this.buildAuthResponse({ ...user, tenant: invite.tenant }),
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

  async getMemberInvite(tenantId: string) {
    const invite = await authRepository.findCurrentMemberInvite(tenantId);
    if (invite) return invite;

    return authRepository.createMemberInvite(tenantId, this.generateInviteCode());
  }

  async regenerateMemberInvite(tenantId: string) {
    await authRepository.deactivateMemberInvites(tenantId);
    return authRepository.createMemberInvite(tenantId, this.generateInviteCode());
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
    console.log(`Assunto: Recuperação de senha`);
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
    return crypto.randomBytes(INVITE_CODE_BYTES).toString("base64url");
  }
}
