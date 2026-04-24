import { prisma } from "../repositories/prismaClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/unifiedConfig";
import { RegisterInput, LoginInput } from "../validators/auth.schema";

export class AuthService {
  async register(input: RegisterInput) {
    const { churchName, name, email, password } = input;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("E-mail já está em uso");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Tenant and TENANT_ADMIN User in a single transaction
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
    const token = this.generateToken(user.id, user.role, tenant.id);

    return {
      token,
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

    const token = this.generateToken(user.id, user.role, user.tenantId);

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  private generateToken(userId: string, role: string, tenantId: string): string {
    return jwt.sign(
      { id: userId, role, tenantId },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );
  }
}
