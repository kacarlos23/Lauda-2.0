const repository = {
  findUserByEmail: jest.fn(),
  savePasswordResetChallenge: jest.fn(),
  invalidatePasswordResetChallenge: jest.fn(),
};
const deliverPasswordResetPin = jest.fn();

jest.mock("../../repositories/authRepository", () => ({
  AuthRepository: jest.fn(() => repository),
}));
jest.mock("../../services/passwordResetDeliveryService", () => ({
  deliverPasswordResetPin: (...args: unknown[]) => deliverPasswordResetPin(...args),
}));

const { AuthService } = require("../../services/authService") as typeof import("../../services/authService");

describe("AuthService password reset delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.savePasswordResetChallenge.mockResolvedValue({});
    repository.invalidatePasswordResetChallenge.mockResolvedValue({ count: 1 });
  });

  it("does not enumerate an existing account when SMTP delivery fails", async () => {
    const service = new AuthService();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    repository.findUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      name: "User",
      email: "existing@example.com",
      password: "hash",
      phone: null,
      avatarUrl: null,
      role: "MEMBER",
      tenantId: "tenant-1",
      isActive: true,
      deletedAt: null,
      tenant: { id: "tenant-1", name: "Tenant", isActive: true, deletedAt: null },
    });
    deliverPasswordResetPin.mockRejectedValueOnce(new Error("SMTP existing@example.com 123456"));

    const existingResponse = await service.requestPasswordReset({ email: "existing@example.com" });

    repository.findUserByEmail.mockResolvedValueOnce(null);
    const missingResponse = await service.requestPasswordReset({ email: "missing@example.com" });

    expect(existingResponse).toEqual(missingResponse);
    expect(repository.invalidatePasswordResetChallenge).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      challengeId: expect.any(String),
    }));
    const serializedLogs = JSON.stringify(consoleSpy.mock.calls);
    expect(serializedLogs).not.toContain("existing@example.com");
    expect(serializedLogs).not.toContain("123456");
    consoleSpy.mockRestore();
  });
});
