import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { config } from "../config/unifiedConfig";
import { UnauthorizedError, ValidationError } from "../errors/AppError";
import { AuthRepository } from "../repositories/authRepository";
import { effectivePermissionKeys } from "./permissionService";
import { isEligibleForAuthentication } from "../security/authEligibility";
import {
  constantTimeEqual,
  createPasswordResetChallengeId,
  createPasswordResetPin,
  passwordResetHmac,
} from "../security/passwordReset";
import { deliverPasswordResetPin } from "./passwordResetDeliveryService";
import {
  createServerSession,
  revokeSession,
  revokeUserSessions,
  rotateServerSession,
  SessionMetadata,
  markSessionStepUp,
} from "./authSessionService";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  mfaOtpAuthUrl,
  verifyTotpCode,
} from "../security/mfa";
import {
  recordLegacyRefreshRejection,
  signAccessToken,
  verifyRefreshToken,
} from "../security/tokenService";
import { logger } from "../observability/logger";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  PublicMemberRegisterInput,
  ChangePasswordInput,
  MfaCodeInput,
  MfaSetupInput,
  StepUpInput,
} from "../validators/auth.schema";

const authRepository = new AuthRepository();
// Keeps the unknown-user login path close to the password-check cost without
// relying on a database value or revealing whether the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("lauda-invalid-login-sentinel", 10);
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
  private async buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    role: string;
    tenantId: string | null;
    tenant?: { id: string; name: string } | null;
    instruments?: Array<{ instrument: { id: string; name: string; colorHex: string | null } }>;
  }, options: {
    metadata?: SessionMetadata;
    rotated?: { sessionId: string; refreshToken: string };
    mfaVerifiedAt?: Date | null;
  } = {}) {
    const identity = { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
    const tokenPair = options.rotated
      ? {
          accessToken: signAccessToken(identity, options.rotated.sessionId),
          refreshToken: options.rotated.refreshToken,
        }
      : await createServerSession(identity, options.metadata, { mfaVerifiedAt: options.mfaVerifiedAt });
    const { accessToken, refreshToken } = tokenPair;

    const permissions = await effectivePermissionKeys(
      { id: user.id, role: user.role as any, tenantId: user.tenantId },
      user.tenantId
    );

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
        permissions,
        mfaEnabled: Boolean((user as { mfaEnabledAt?: Date | null }).mfaEnabledAt),
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
  async register(input: RegisterInput, metadata?: SessionMetadata) {
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
    const auth = await this.buildAuthResponse({ ...user, tenantId: tenant.id }, { metadata });

    return {
      ...auth,
      tenant: { id: tenant.id, name: tenant.name },
    };
  }

  async registerPublicMember(input: PublicMemberRegisterInput, metadata?: SessionMetadata) {
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
      ...await this.buildAuthResponse(user, { metadata }),
      tenant: invite.tenant,
    };
  }

  /**
   * Authenticates a user and issues access and refresh tokens.
   *
   * @param input Validated login credentials.
   * @returns Authentication payload with token pair and user data.
   */
  async login(input: LoginInput, metadata?: SessionMetadata) {
    const { email, password } = input;

    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError("Credenciais inválidas");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    if (!isEligibleForAuthentication(user)) {
      throw new UnauthorizedError("Usuário ou tenant inativo, excluído ou indisponível");
    }

    let mfaVerifiedAt: Date | null = null;
    if (user.role === Role.GLOBAL_ADMIN && config.auth.mfa.globalAdminRequired) {
      if (!user.mfaEnabledAt || !user.mfaSecretEncrypted || !input.mfaCode) {
        throw new UnauthorizedError("MFA obrigatório para administrador global");
      }
      if (!verifyTotpCode(decryptMfaSecret(user.mfaSecretEncrypted), input.mfaCode)) {
        throw new UnauthorizedError("Credenciais inválidas");
      }
      mfaVerifiedAt = new Date();
    }

    if (input.inviteCode) {
      await this.applyInviteToExistingUser(input.inviteCode, user);
    }

    return this.buildAuthResponse(user, { metadata, mfaVerifiedAt });
  }

  async setupMfa(userId: string, input: MfaSetupInput) {
    const user = await authRepository.findUserById(userId);
    if (!isEligibleForAuthentication(user) || !await bcrypt.compare(input.currentPassword, user.password)) {
      throw new UnauthorizedError("Senha atual inválida");
    }
    const secret = generateMfaSecret();
    const saved = await authRepository.savePendingMfaSecret(userId, encryptMfaSecret(secret));
    if (saved.count !== 1) throw new UnauthorizedError("Usuário indisponível");
    return { secret, otpAuthUrl: mfaOtpAuthUrl(user.email, secret) };
  }

  async confirmMfa(userId: string, sessionId: string, input: MfaCodeInput) {
    const user = await authRepository.findUserById(userId);
    if (!isEligibleForAuthentication(user) || !user.mfaSecretEncrypted) {
      throw new ValidationError("Configuração MFA não iniciada");
    }
    if (!verifyTotpCode(decryptMfaSecret(user.mfaSecretEncrypted), input.code)) {
      throw new UnauthorizedError("Código MFA inválido");
    }
    const enabled = await authRepository.enableMfa(userId);
    if (enabled.count !== 1) throw new ValidationError("Não foi possível habilitar MFA");
    const verifiedAt = new Date();
    const stepUpExpiresAt = new Date(verifiedAt.getTime() + config.auth.mfa.stepUpTtlMinutes * 60_000);
    await markSessionStepUp(sessionId, userId, verifiedAt, stepUpExpiresAt);
    return { enabled: true, verifiedAt, stepUpExpiresAt };
  }

  async stepUp(userId: string, sessionId: string, input: StepUpInput) {
    const user = await authRepository.findUserById(userId);
    if (
      !isEligibleForAuthentication(user) ||
      !user.mfaEnabledAt ||
      !user.mfaSecretEncrypted ||
      !await bcrypt.compare(input.currentPassword, user.password) ||
      !verifyTotpCode(decryptMfaSecret(user.mfaSecretEncrypted), input.code)
    ) {
      throw new UnauthorizedError("Não foi possível elevar a sessão");
    }
    const verifiedAt = new Date();
    const expiresAt = new Date(verifiedAt.getTime() + config.auth.mfa.stepUpTtlMinutes * 60_000);
    if (!await markSessionStepUp(sessionId, userId, verifiedAt, expiresAt)) {
      throw new UnauthorizedError("Sessão inválida");
    }
    return { verifiedAt, expiresAt };
  }

  /**
   * Exchanges a valid refresh token for a new token pair.
   *
   * @param input Validated refresh-token payload.
   * @returns Authentication payload with renewed token pair and user data.
   */
  async refresh(input: RefreshTokenInput) {
    let decoded;
    try {
      decoded = verifyRefreshToken(input.refreshToken);
    } catch {
      recordLegacyRefreshRejection(input.refreshToken);
      throw new UnauthorizedError("Refresh token inválido");
    }
    const rotation = await rotateServerSession(input.refreshToken, decoded);
    if (rotation.status === "reuse") {
      logger.warn("auth_refresh_reuse_detected", { category: "security", outcome: "revoked" });
      throw new UnauthorizedError("Refresh token reutilizado; sessão revogada");
    }
    if (rotation.status !== "rotated") {
      throw new UnauthorizedError("Refresh token inválido");
    }

    const user = await authRepository.findUserById(rotation.userId);
    if (!isEligibleForAuthentication(user)) {
      await revokeUserSessions(rotation.userId, "authentication_ineligible");
      throw new UnauthorizedError("Usuário ou tenant inativo, excluído ou indisponível");
    }

    return this.buildAuthResponse(user, {
      rotated: { sessionId: rotation.sessionId, refreshToken: rotation.refreshToken },
    });
  }

  async logout(userId: string, sessionId: string) {
    await revokeSession(sessionId, userId, "logout");
    return { success: true, message: "Sessão encerrada com sucesso." };
  }

  async logoutAll(userId: string) {
    const revokedSessions = await revokeUserSessions(userId, "logout_global");
    return { success: true, revokedSessions, message: "Todas as sessões foram encerradas." };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await authRepository.findUserById(userId);
    if (!isEligibleForAuthentication(user) || !await bcrypt.compare(input.currentPassword, user.password)) {
      throw new UnauthorizedError("Senha atual inválida");
    }
    const hashedPassword = await bcrypt.hash(input.newPassword, 10);
    await authRepository.changePasswordAndRevokeSessions(userId, hashedPassword);
    return { success: true, message: "Senha atualizada; todas as sessões foram encerradas." };
  }

  async me(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!isEligibleForAuthentication(user)) {
      throw new UnauthorizedError("Usuário ou tenant inativo, excluído ou indisponível");
    }

    const permissions = await effectivePermissionKeys(
      { id: user.id, role: user.role as any, tenantId: user.tenantId },
      user.tenantId
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
        tenantId: user.tenantId,
        instruments: user.instruments?.map((item) => item.instrument) ?? [],
        permissions,
        mfaEnabled: Boolean(user.mfaEnabledAt),
      },
      tenant: user.tenant ?? null,
      permissions,
    };
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

  /** Requests a single-use password reset challenge without logging its PIN. */
  async requestPasswordReset(input: ForgotPasswordInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!isEligibleForAuthentication(user)) {
      // Return generic success message to prevent email enumeration
      return { success: true, message: "Se o e-mail existir, um código foi enviado." };
    }

    const pin = config.auth.passwordResetTestPin ?? createPasswordResetPin();
    const challengeId = createPasswordResetChallengeId();
    const tokenHmac = passwordResetHmac({
      pepper: config.auth.passwordResetPepper,
      challengeId,
      userId: user.id,
      pin,
    });
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await authRepository.savePasswordResetChallenge({
      userId: user.id,
      tokenHmac,
      challengeId,
      pepperVersion: config.auth.passwordResetPepperVersion,
      expiresAt,
    });
    try {
      await deliverPasswordResetPin(user.email, pin);
    } catch {
      // Delivery failures must not disclose whether the account exists.
      await authRepository.invalidatePasswordResetChallenge({
        userId: user.id,
        challengeId,
        now: new Date(),
      }).catch(() => undefined);
      logger.error("password_reset_delivery_failed", { category: "security", outcome: "error" });
    }

    return { success: true, message: "Se o e-mail existir, um código foi enviado." };
  }

  /** Validates and atomically consumes a password reset challenge. */
  async resetPassword(input: ResetPasswordInput) {
    const { email, token, newPassword } = input;
    const user = await authRepository.findUserForPasswordReset(email);
    const now = new Date();
    const hasActiveChallenge = Boolean(
      user?.resetPasswordToken &&
      user.resetPasswordChallengeId &&
      user.resetPasswordPepperVersion === config.auth.passwordResetPepperVersion &&
      user.resetPasswordExpires &&
      user.resetPasswordExpires > now &&
      !user.resetPasswordConsumedAt &&
      user.resetPasswordAttempts < config.auth.passwordResetMaxAttempts,
    );

    if (!user || !hasActiveChallenge) {
      throw new ValidationError("PIN inválido ou expirado.");
    }

    const candidateHmac = passwordResetHmac({
      pepper: config.auth.passwordResetPepper,
      challengeId: user.resetPasswordChallengeId!,
      userId: user.id,
      pin: token,
    });

    if (!constantTimeEqual(candidateHmac, user.resetPasswordToken!)) {
      await authRepository.recordInvalidPasswordResetAttempt({
        userId: user.id,
        challengeId: user.resetPasswordChallengeId!,
        maxAttempts: config.auth.passwordResetMaxAttempts,
        now,
      });
      throw new ValidationError("PIN inválido ou expirado.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const consumed = await authRepository.consumePasswordResetChallenge({
      userId: user.id,
      challengeId: user.resetPasswordChallengeId!,
      tokenHmac: candidateHmac,
      maxAttempts: config.auth.passwordResetMaxAttempts,
      now,
      hashedPassword,
    });
    if (consumed.count !== 1) {
      throw new ValidationError("PIN inválido ou expirado.");
    }

    return { success: true, message: "Senha atualizada com sucesso." };
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
