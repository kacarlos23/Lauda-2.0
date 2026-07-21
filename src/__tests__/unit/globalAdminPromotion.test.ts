import { Role } from "@prisma/client";
import { GlobalAdminPromotionRequest, promoteGlobalAdmin } from "../../services/globalAdminPromotion";

const request = (targetEmail = "target@example.com"): GlobalAdminPromotionRequest => ({
  targetEmail,
  actorId: "actor-1",
  reason: "Necessidade operacional aprovada",
  ticketReference: "SEC-123",
  confirmation: `PROMOTE ${targetEmail}`,
});

describe("promoteGlobalAdmin", () => {
  it("exige alvo explícito e delega promoção com auditoria sem senha", async () => {
    const stored = { id: "user-1", email: "target@example.com", role: Role.MEMBER, tenantId: "tenant-1" };
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(stored),
      promoteWithAudit: jest.fn().mockResolvedValue({ ...stored, role: Role.GLOBAL_ADMIN, tenantId: null }),
    };

    const result = await promoteGlobalAdmin(repository, request());

    expect(repository.findUserByEmail).toHaveBeenCalledWith("target@example.com");
    expect(repository.promoteWithAudit).toHaveBeenCalledWith(expect.objectContaining({
      targetEmail: "target@example.com",
      targetUserId: "user-1",
      reason: "Necessidade operacional aprovada",
      ticketReference: "SEC-123",
    }));
    expect(JSON.stringify(repository.promoteWithAudit.mock.calls)).not.toMatch(/password|secret123/i);
    expect(result).toMatchObject({ role: Role.GLOBAL_ADMIN, tenantId: null });
  });

  it("falha claramente quando usuário não existe", async () => {
    const repository = { findUserByEmail: jest.fn().mockResolvedValue(null), promoteWithAudit: jest.fn() };
    await expect(promoteGlobalAdmin(repository, request("missing@example.com"))).rejects.toThrow("Usuário não encontrado");
    expect(repository.promoteWithAudit).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...request(), reason: "curto" }, "motivo"],
    [{ ...request(), ticketReference: "" }, "ticket"],
    [{ ...request(), confirmation: "yes" }, "Confirmação inválida"],
  ])("rejeita promoção sem requisitos administrativos", async (invalidRequest, message) => {
    const repository = { findUserByEmail: jest.fn(), promoteWithAudit: jest.fn() };
    await expect(promoteGlobalAdmin(repository, invalidRequest)).rejects.toThrow(message);
    expect(repository.promoteWithAudit).not.toHaveBeenCalled();
  });
});
