import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import DashboardScreen from "../../app/(tabs)";

type Role = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";

type TestNode = TestRenderer.ReactTestInstance;

const pushMock = jest.fn();
const loadMySchedulesMock = jest.fn();
const loadMembersMock = jest.fn();
let currentRole: Role = "MEMBER";
let currentMembers: any[] = [];

function permissionsForRole(role: Role): string[] {
  switch (role) {
    case "GLOBAL_ADMIN":
      return [];
    case "TENANT_ADMIN":
      return [
        "schedule:create",
        "song:create",
        "song:edit",
        "member:create",
        "member:view",
        "member:invite",
        "member:assign_ministry",
        "ministry:create",
        "instrument:create",
        "tenant:manage",
      ];
    case "MINISTRY_LEADER":
      return [
        "schedule:create",
        "song:create",
        "song:edit",
        "member:view",
      ];
    default:
      return [];
  }
}

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Modal: ({ children, visible, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return {
    CalendarClock: Icon,
    Church: Icon,
    ClipboardList: Icon,
    Music2: Icon,
    Plus: Icon,
    Settings2: Icon,
    UserPlus: Icon,
    UsersRound: Icon,
  };
});

jest.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: {
      id: "user-1",
      name: "Usuário Teste",
      role: currentRole,
      tenantId: "tenant-1",
      permissions: permissionsForRole(currentRole),
    },
    tenant: { id: "tenant-1", name: "Igreja Teste" },
  }),
}));

jest.mock("../store/scheduleStore", () => ({
  useScheduleStore: () => ({
    schedules: [{
      id: "assignment-1",
      scheduleId: "schedule-1",
      userId: "user-1",
      role: "Vocal",
      status: "PENDING",
      schedule: {
        id: "schedule-1",
        title: "Culto de Domingo",
        date: new Date(Date.now() + 86400000).toISOString(),
        ministryId: "ministry-1",
        tenantId: "tenant-1",
        ministry: { id: "ministry-1", name: "Louvor" },
      },
    }],
    loading: false,
    error: null,
    loadMySchedules: loadMySchedulesMock,
  }),
}));

jest.mock("../store/memberStore", () => ({
  useMemberStore: () => ({
    members: currentMembers,
    loading: false,
    loadMembers: loadMembersMock,
  }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

async function renderDashboard(role: Role) {
  currentRole = role;
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<DashboardScreen />);
  });
  return renderer!;
}

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
}

describe("Dashboard central de ações", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentMembers = [
      { id: "member-1", name: "Ana", role: "MEMBER", tenantId: "tenant-1", ministries: [], instruments: [] },
      { id: "member-2", name: "Bruno", role: "MEMBER", tenantId: "tenant-1", ministries: [{ ministry: { id: "m1", name: "Louvor" }, isLeader: false }], instruments: [] },
    ];
  });

  it("renderiza dashboard de membro sem ações protegidas", async () => {
    const renderer = await renderDashboard("MEMBER");
    const text = textContent(renderer);

    expect(text).toContain("Ações rápidas");
    expect(text).toContain("Escalas pendentes");
    expect(text).not.toContain("Criar escala");
    expect(text).not.toContain("Convidar membro");
    expect(text).not.toContain("Cadastrar música");
    expect(text).not.toContain("Criar ministério");
    expect(text).not.toContain("Atenção em membros");
    expect(loadMembersMock).not.toHaveBeenCalled();
  });

  it("renderiza dashboard de líder com atalhos adicionais de música", async () => {
    const renderer = await renderDashboard("MINISTRY_LEADER");
    const text = textContent(renderer);

    expect(text).toContain("Criar escala");
    expect(text).toContain("Cadastrar música");
    expect(text).toContain("Gerenciar artistas");
    expect(text).toContain("Atenção em membros");
    expect(text).not.toContain("Convidar membro");
    expect(text).not.toContain("Criar ministério");
    expect(text).not.toContain("Painel global");
    expect(loadMembersMock).not.toHaveBeenCalled();
  });

  it("renderiza dashboard de admin com atalhos administrativos expandidos", async () => {
    const renderer = await renderDashboard("TENANT_ADMIN");
    const text = textContent(renderer);

    expect(text).toContain("Criar escala");
    expect(text).toContain("Convidar membro");
    expect(text).toContain("Cadastrar música");
    expect(text).toContain("Criar ministério");
    expect(text).toContain("Gerenciar artistas");
    expect(text).toContain("Instrumentos");
    expect(text).toContain("Dados da igreja");
    expect(text).toContain("Sem ministério");
    expect(text).toContain("Sem instrumento/cargo");
    expect(text).not.toContain("Painel global");
    expect(loadMembersMock).not.toHaveBeenCalled();
  });

  it("renderiza dashboard global com atalhos globais", async () => {
    const renderer = await renderDashboard("GLOBAL_ADMIN");
    const text = textContent(renderer);

    expect(text).toContain("Painel global");
    expect(text).toContain("Dados da igreja");
    expect(text).toContain("Gerenciar artistas");
    expect(text).toContain("Instrumentos");
  });

  it("carrega membros apenas para perfil com acesso quando a store esta vazia", async () => {
    currentMembers = [];

    await renderDashboard("MINISTRY_LEADER");

    expect(loadMembersMock).toHaveBeenCalledTimes(1);
  });
});
