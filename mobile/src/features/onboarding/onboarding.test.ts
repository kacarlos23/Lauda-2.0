const mockStorage = new Map<string, string>();
const mockUpdateMyOnboarding = jest.fn();
const mockApplyCurrentUser = jest.fn();

jest.mock("lucide-react-native", () => {
  const Icon = () => null;
  return {
    Building2: Icon,
    CalendarClock: Icon,
    Church: Icon,
    Ellipsis: Icon,
    Guitar: Icon,
    Home: Icon,
    Music2: Icon,
    Shield: Icon,
    User: Icon,
    UserCircle2: Icon,
    Users: Icon,
  };
});

jest.mock("../../services/sessionStorage", () => ({
  getSessionItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setSessionItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  deleteSessionItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("../../services/memberService", () => ({
  memberService: {
    updateMyOnboarding: (...args: unknown[]) => mockUpdateMyOnboarding(...args),
  },
}));

jest.mock("../../store/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      applyCurrentUser: mockApplyCurrentUser,
    }),
  },
}));

import type { User } from "../../types";
import { rolePermissionMap } from "../../utils/permissions";
import { buildOnboardingSteps } from "./steps";
import { useOnboardingStore } from "./onboardingStore";
import { onboardingScopeKeyFor } from "./onboardingStorage";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Membro Teste",
    email: "membro@igreja.com",
    role: "MEMBER",
    tenantId: "tenant-1",
    permissions: rolePermissionMap.MEMBER,
    instruments: [],
    onboarding: {
      version: "v1",
      status: "not_started",
      shouldAutoStart: true,
      completedAt: null,
      dismissedAt: null,
      updatedAt: null,
    },
    ...overrides,
  };
}

describe("buildOnboardingSteps", () => {
  it("monta passos mobile para membro comum com instruções corretas", () => {
    const steps = buildOnboardingSteps(
      { role: "MEMBER", permissions: rolePermissionMap.MEMBER },
      { isMobile: true }
    );
    expect(steps.map((step) => step.title)).toEqual([
      "Início",
      "Escalas",
      "Músicas",
      "Mais",
      "Vincule seu instrumento ou cargo",
    ]);
    expect(steps[steps.length - 1].description).toBe(
      "Para ser escalado em uma função, vincule ao seu perfil o instrumento ou cargo correspondente."
    );
  });

  it("inclui itens administrativos na sidebar desktop para TENANT_ADMIN", () => {
    const steps = buildOnboardingSteps(
      { role: "TENANT_ADMIN", permissions: rolePermissionMap.TENANT_ADMIN },
      { isMobile: false }
    );
    expect(steps.map((step) => step.title)).toEqual([
      "Início",
      "Escalas",
      "Ministérios",
      "Músicas",
      "Membros",
      "Artistas",
      "Instrumentos/Cargos",
      "Igreja",
      "Perfil",
      "Vincule seu instrumento ou cargo",
    ]);
    expect(steps.find((step) => step.route === "instruments")?.sidebarTestId).toBe(
      "sidebar-nav-instruments"
    );
  });
});

describe("useOnboardingStore", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockUpdateMyOnboarding.mockReset();
    mockApplyCurrentUser.mockReset();
    useOnboardingStore.getState().reset();
  });

  it("abre automaticamente apenas para novas contas e retoma o passo salvo após interrupção", async () => {
    const newUser = makeUser();
    await useOnboardingStore.getState().syncForUser(newUser);
    expect(useOnboardingStore.getState().visible).toBe(true);
    expect(useOnboardingStore.getState().stepIndex).toBe(0);

    useOnboardingStore.getState().nextStep(6, newUser);
    useOnboardingStore.getState().nextStep(6, newUser);
    expect(useOnboardingStore.getState().stepIndex).toBe(2);

    // Simula reinicialização na mesma conta/aparelho
    useOnboardingStore.getState().reset();
    await useOnboardingStore.getState().syncForUser(newUser);
    expect(useOnboardingStore.getState().visible).toBe(true);
    expect(useOnboardingStore.getState().stepIndex).toBe(2);
  });

  it("não abre automaticamente para contas antigas sem registro de onboarding", async () => {
    const legacyUser = makeUser({
      onboarding: {
        version: "v1",
        status: "not_started",
        shouldAutoStart: false,
      },
    });
    await useOnboardingStore.getState().syncForUser(legacyUser);
    expect(useOnboardingStore.getState().visible).toBe(false);

    // Ainda permite rever o tutorial manualmente
    useOnboardingStore.getState().startReview(legacyUser);
    expect(useOnboardingStore.getState().visible).toBe(true);
    expect(useOnboardingStore.getState().reviewMode).toBe(true);
  });

  it("persiste dispensa ao pular e marca como concluído após vínculo de instrumento confirmado", async () => {
    const user = makeUser();
    mockUpdateMyOnboarding.mockResolvedValueOnce({
      version: "v1",
      status: "dismissed",
      shouldAutoStart: false,
      completedAt: null,
      dismissedAt: "2026-11-19T22:00:00.000Z",
      updatedAt: "2026-11-19T22:00:00.000Z",
    });

    await useOnboardingStore.getState().syncForUser(user);
    await useOnboardingStore.getState().skipTutorial(user);

    expect(useOnboardingStore.getState().visible).toBe(false);
    expect(useOnboardingStore.getState().dismissedScopes[onboardingScopeKeyFor(user)]).toBe(true);
    expect(mockUpdateMyOnboarding).toHaveBeenCalledWith({ version: "v1", status: "dismissed" });

    // Rever tutorial e ir até Perfil para vincular instrumento
    mockUpdateMyOnboarding.mockResolvedValueOnce({
      version: "v1",
      status: "completed",
      shouldAutoStart: false,
      completedAt: "2026-11-19T22:05:00.000Z",
      dismissedAt: null,
      updatedAt: "2026-11-19T22:05:00.000Z",
    });

    useOnboardingStore.getState().startReview(user);
    useOnboardingStore.getState().openProfileInstruments(user);
    expect(useOnboardingStore.getState().awaitingInstrumentLink).toBe(true);

    const linkedUser = makeUser({
      instruments: [{ id: "inst-1", name: "Violão", colorHex: "#2563EB" }],
    });
    await useOnboardingStore.getState().syncForUser(linkedUser);

    expect(mockUpdateMyOnboarding).toHaveBeenLastCalledWith({ version: "v1", status: "completed" });
    expect(useOnboardingStore.getState().awaitingInstrumentLink).toBe(false);
  });
});
