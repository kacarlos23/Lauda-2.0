import { Role } from "@prisma/client";
import { GLOBAL_ADMIN_EMAIL, promoteGlobalAdmin } from "../../services/globalAdminPromotion";

describe("promoteGlobalAdmin", () => {
  it("promove usuário existente para o e-mail alvo sem alterar senha nem criar usuário", async () => {
    const stored = {
      id: "user-1",
      email: GLOBAL_ADMIN_EMAIL,
      role: Role.MEMBER,
    };
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(stored),
      updateUserRole: jest.fn().mockImplementation(async (email, role) => ({ ...stored, email, role })),
    };

    const result = await promoteGlobalAdmin(repository);

    expect(repository.findUserByEmail).toHaveBeenCalledWith(GLOBAL_ADMIN_EMAIL);
    expect(repository.updateUserRole).toHaveBeenCalledWith(GLOBAL_ADMIN_EMAIL, Role.GLOBAL_ADMIN);
    expect(JSON.stringify(repository.updateUserRole.mock.calls)).not.toContain("password");
    expect(result.role).toBe(Role.GLOBAL_ADMIN);
  });

  it("falha claramente quando usuário não existe", async () => {
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(null),
      updateUserRole: jest.fn(),
    };

    await expect(promoteGlobalAdmin(repository, "missing@example.com")).rejects.toThrow("Usuário não encontrado");
    expect(repository.updateUserRole).not.toHaveBeenCalled();
  });

  it("permite promover e-mail explícito alterando apenas role", async () => {
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue({ id: "user-2", email: "other@example.com", role: Role.MEMBER }),
      updateUserRole: jest.fn().mockResolvedValue({ id: "user-2", email: "other@example.com", role: Role.GLOBAL_ADMIN }),
    };

    await expect(promoteGlobalAdmin(repository, "other@example.com")).resolves.toMatchObject({
      role: Role.GLOBAL_ADMIN,
    });
    expect(repository.updateUserRole).toHaveBeenCalledWith("other@example.com", Role.GLOBAL_ADMIN);
    expect(JSON.stringify(repository)).not.toMatch(/secret123|passwordHash/i);
  });
});
