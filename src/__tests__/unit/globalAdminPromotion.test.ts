import { Role } from "@prisma/client";
import { promoteGlobalAdmin } from "../../services/globalAdminPromotion";

describe("promoteGlobalAdmin", () => {
  it("promove usuário existente sem alterar senha", async () => {
    const stored = {
      id: "user-1",
      email: "admin@example.com",
      role: Role.MEMBER,
    };
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(stored),
      updateUserRole: jest.fn().mockImplementation(async (email, role) => ({ ...stored, email, role })),
    };

    const result = await promoteGlobalAdmin(repository, stored.email);

    expect(repository.updateUserRole).toHaveBeenCalledWith(stored.email, Role.GLOBAL_ADMIN);
    expect(result.role).toBe(Role.GLOBAL_ADMIN);
  });

  it("falha claramente quando usuário não existe", async () => {
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(null),
      updateUserRole: jest.fn(),
    };

    await expect(promoteGlobalAdmin(repository, "missing@example.com")).rejects.toThrow(
      "Usuário não encontrado"
    );
    expect(repository.updateUserRole).not.toHaveBeenCalled();
  });
});
