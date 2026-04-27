import { prisma } from "../repositories/prismaClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
} from "../validators/auth.schema";

interface RefreshTokenPayload {
  id: string;
  type: "refresh";
}

export class AuthService {
  async register(input: RegisterInput) {
    const { churchName, name, email, password } = input;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("E-mail já está em uso");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        name: churchName,
        users: {
          create: {
            name,
            email,
            password: hashedPassword,
            role: "TENANT_ADMIN",
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];

    return {
      token: this.generateAccessToken(user.id, user.role, tenant.id),
      refreshToken: this.generateRefreshToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: tenant.id, name: tenant.name },
    };
  }

  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("Credenciais inválidas");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Credenciais inválidas");
    }

    return {
      token: this.generateAccessToken(user.id, user.role, user.tenantId),
      refreshToken: this.generateRefreshToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refresh(input: RefreshTokenInput) {
    const decoded = jwt.verify(
      input.refreshToken,
      config.auth.refreshJwtSecret
    ) as RefreshTokenPayload;

    if (decoded.type !== "refresh") {
      throw new Error("Refresh token inválido");
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    return {
      token: this.generateAccessToken(user.id, user.role, user.tenantId),
      refreshToken: this.generateRefreshToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  private generateAccessToken(userId: string, role: string, tenantId: string): string {
    return jwt.sign(
      { id: userId, role, tenantId },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { id: userId, type: "refresh" },
      config.auth.refreshJwtSecret,
      { expiresIn: config.auth.refreshJwtExpiresIn } as jwt.SignOptions
    );
  }
}
