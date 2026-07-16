import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../../config/unifiedConfig";
import { basePrisma } from "../../config/prisma";
import { getTenantContext, TenantContext } from "../../context/tenantContext";
import { ForbiddenError, UnauthorizedError } from "../../errors/AppError";
import { authMiddleware, requireRole } from "../../middlewares/authMiddleware";
import { effectivePermissionKeys } from "../../services/permissionService";

jest.mock("../../config/prisma", () => ({
  basePrisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../services/permissionService", () => ({
  effectivePermissionKeys: jest.fn(),
  hasPermission: jest.fn(),
}));

const findUnique = basePrisma.user.findUnique as jest.Mock;
const effectivePermissions = effectivePermissionKeys as jest.MockedFunction<typeof effectivePermissionKeys>;

type StoredUser = {
  id: string;
  role: Role;
  tenantId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  tenant: { isActive: boolean; deletedAt: Date | null } | null;
};

function signedToken(claims: { userId?: string; id?: string; role: Role; tenantId: string | null }): string {
  return jwt.sign(claims, config.auth.jwtSecret, { expiresIn: "15m" });
}

function requestWithToken(token: string): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
    params: {},
  } as Request;
}

function currentUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: "user-1",
    role: Role.MEMBER,
    tenantId: "tenant-a",
    isActive: true,
    deletedAt: null,
    tenant: { isActive: true, deletedAt: null },
    ...overrides,
  };
}

async function authenticate(
  token: string
): Promise<{ req: Request; next: jest.Mock; context: TenantContext | undefined }> {
  const req = requestWithToken(token);
  let context: TenantContext | undefined;
  const next = jest.fn((error?: unknown) => {
    if (!error) context = getTenantContext();
  });

  await authMiddleware(req, {} as Response, next as NextFunction);
  return { req, next, context };
}

function expectUnauthorized(next: jest.Mock): void {
  expect(next).toHaveBeenCalledTimes(1);
  const error = next.mock.calls[0][0];
  expect(error).toBeInstanceOf(UnauthorizedError);
  expect(error.statusCode).toBe(401);
}

describe("authMiddleware current user source of truth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    effectivePermissions.mockResolvedValue(["song:view"]);
  });

  it("autentica usuário ativo e preenche req.user com os dados atuais do banco", async () => {
    findUnique.mockResolvedValue(currentUser());
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { req, next, context } = await authenticate(token);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: "user-1",
      role: Role.MEMBER,
      tenantId: "tenant-a",
      permissions: ["song:view"],
    });
    expect(context).toEqual({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });
    expect(effectivePermissions).toHaveBeenCalledWith(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" },
      "tenant-a"
    );
  });

  it("usa a role atual MEMBER após rebaixamento de um token TENANT_ADMIN", async () => {
    findUnique.mockResolvedValue(currentUser({ role: Role.MEMBER }));
    const token = signedToken({ userId: "user-1", role: Role.TENANT_ADMIN, tenantId: "tenant-a" });

    const { req } = await authenticate(token);

    expect(req.user?.role).toBe(Role.MEMBER);
    const authorizationNext = jest.fn();
    requireRole(Role.TENANT_ADMIN)(req, {} as Response, authorizationNext as NextFunction);
    expect(authorizationNext.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    expect(authorizationNext.mock.calls[0][0].statusCode).toBe(403);
  });

  it("usa o tenant atual do banco no req.user e no tenant context", async () => {
    findUnique.mockResolvedValue(currentUser({ tenantId: "tenant-b" }));
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { req, context } = await authenticate(token);

    expect(req.user?.tenantId).toBe("tenant-b");
    expect(context?.tenantId).toBe("tenant-b");
    expect(effectivePermissions).toHaveBeenCalledWith(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-b" },
      "tenant-b"
    );
    expect(effectivePermissions).not.toHaveBeenCalledWith(expect.anything(), "tenant-a");
  });

  it("nega usuário atual inativo com 401 e não continua a requisição", async () => {
    findUnique.mockResolvedValue(currentUser({ isActive: false }));
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { req, next, context } = await authenticate(token);

    expectUnauthorized(next);
    expect(req.user).toBeUndefined();
    expect(context).toBeUndefined();
    expect(effectivePermissions).not.toHaveBeenCalled();
  });

  it("nega usuário excluído logicamente", async () => {
    findUnique.mockResolvedValue(currentUser({ deletedAt: new Date() }));
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { next } = await authenticate(token);

    expectUnauthorized(next);
    expect(effectivePermissions).not.toHaveBeenCalled();
  });

  it.each([
    { isActive: false, deletedAt: null },
    { isActive: true, deletedAt: new Date() },
  ])("nega tenant inativo ou excluído", async (tenant) => {
    findUnique.mockResolvedValue(currentUser({ tenant }));
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { next } = await authenticate(token);

    expectUnauthorized(next);
    expect(effectivePermissions).not.toHaveBeenCalled();
  });

  it("nega com 401 quando o usuário do JWT não existe mais", async () => {
    findUnique.mockResolvedValue(null);
    const token = signedToken({ userId: "removed-user", role: Role.MEMBER, tenantId: "tenant-a" });

    const { req, next } = await authenticate(token);

    expectUnauthorized(next);
    expect(req.user).toBeUndefined();
    expect(effectivePermissions).not.toHaveBeenCalled();
  });

  it("nega com 401 usuário não-global sem tenant atual", async () => {
    findUnique.mockResolvedValue(currentUser({ tenantId: null }));
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    const { req, next } = await authenticate(token);

    expectUnauthorized(next);
    expect(req.user).toBeUndefined();
    expect(effectivePermissions).not.toHaveBeenCalled();
  });

  it("permite GLOBAL_ADMIN atual sem tenant", async () => {
    findUnique.mockResolvedValue(currentUser({ role: Role.GLOBAL_ADMIN, tenantId: null, tenant: null }));
    effectivePermissions.mockResolvedValue(["permissions:manage"]);
    const token = signedToken({ userId: "user-1", role: Role.GLOBAL_ADMIN, tenantId: null });

    const { req, next, context } = await authenticate(token);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: "user-1",
      role: Role.GLOBAL_ADMIN,
      tenantId: "",
      permissions: ["permissions:manage"],
    });
    expect(context).toEqual({ userId: "user-1", role: Role.GLOBAL_ADMIN, tenantId: null });
    expect(effectivePermissions).toHaveBeenCalledWith(
      { id: "user-1", role: Role.GLOBAL_ADMIN, tenantId: null },
      null
    );
  });

  it("ignora role adulterada em JWT criptograficamente válido", async () => {
    findUnique.mockResolvedValue(currentUser({ role: Role.MEMBER }));
    const token = signedToken({ userId: "user-1", role: Role.GLOBAL_ADMIN, tenantId: "tenant-a" });

    const { req, next, context } = await authenticate(token);

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.role).toBe(Role.MEMBER);
    expect(context?.role).toBe(Role.MEMBER);
    expect(effectivePermissions).toHaveBeenCalledWith(
      { id: "user-1", role: Role.MEMBER, tenantId: "tenant-a" },
      "tenant-a"
    );
  });

  it("propaga falha de banco em vez de convertê-la em 401", async () => {
    const databaseError = new Error("database unavailable");
    findUnique.mockRejectedValue(databaseError);
    const token = signedToken({ userId: "user-1", role: Role.MEMBER, tenantId: "tenant-a" });

    await expect(authMiddleware(
      requestWithToken(token),
      {} as Response,
      jest.fn() as NextFunction,
    )).rejects.toBe(databaseError);
  });
});
