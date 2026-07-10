import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Text, TouchableOpacity } from "react-native";
import EditScheduleScreen from "../../app/(tabs)/schedules/[id]/edit";

type TestNode = TestRenderer.ReactTestInstance;

const replaceMock = jest.fn();
const deleteScheduleMock = jest.fn();
const loadSchedulesMock = jest.fn();
const updateScheduleMock = jest.fn();
let currentRole = "TENANT_ADMIN";

const schedule = {
  id: "schedule-1",
  title: "Culto exclusao",
  date: "2026-07-12T22:00:00.000Z",
  ministryId: "ministry-1",
  tenantId: "tenant-1",
  ministry: { id: "ministry-1", name: "Louvor" },
  songs: [],
  assignments: [{ id: "assignment-1", scheduleId: "schedule-1", userId: "user-1", role: "Vocal", status: "ACCEPTED", user: { id: "user-1", name: "Ana" } }],
};

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
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

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "schedule-1" }),
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { ArrowLeft: Icon, Calendar: Icon, Clock: Icon, Download: Icon };
});

jest.mock("../../src/components/AppBackButton", () => ({
  AppBackButton: () => null,
}));

jest.mock("../../src/components/DateTimeInput", () => ({
  DateTimeInput: ({ label, value }: any) => React.createElement("DateTimeInput", { label, value }),
}));

jest.mock("../../src/services/memberService", () => ({
  memberService: { listMembers: jest.fn(() => Promise.resolve([])) },
}));

jest.mock("../../src/services/ministryApi", () => ({
  ministryApi: {
    getMinistries: jest.fn(() => Promise.resolve([{ id: "ministry-1", name: "Louvor", tenantId: "tenant-1", createdAt: "" }])),
    listMembers: jest.fn(() => Promise.resolve({ items: [] })),
  },
}));

jest.mock("../../src/services/musicService", () => ({
  musicService: { listSongs: jest.fn(() => Promise.resolve({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })) },
}));

jest.mock("../../src/services/scheduleService", () => ({
  scheduleService: { exportScheduleReport: jest.fn(() => Promise.resolve()) },
}));

jest.mock("../../src/store/authStore", () => ({
  useAuthStore: (selector: any) => selector({ user: { id: "admin-1", role: currentRole } }),
}));

jest.mock("../../src/store/scheduleStore", () => ({
  useScheduleStore: () => ({
    allSchedules: [schedule],
    loadSchedules: loadSchedulesMock,
    updateSchedule: updateScheduleMock,
    deleteSchedule: deleteScheduleMock,
    saving: false,
    error: null,
  }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

async function renderScreen() {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<EditScheduleScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer!;
}

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
}

function findDeleteButton(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType(TouchableOpacity)
    .find((node: TestNode) => node.props.accessibilityLabel === "Excluir escala");
}

describe("EditScheduleScreen exclusao", () => {
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
    currentRole = "TENANT_ADMIN";
    deleteScheduleMock.mockResolvedValue(undefined);
  });

  it("nao mostra botao para usuario sem permissao", async () => {
    currentRole = "MEMBER";
    const renderer = await renderScreen();

    expect(textContent(renderer)).toContain("permiss");
    expect(findDeleteButton(renderer)).toBeUndefined();
  });

  it("cancela exclusao sem chamar API", async () => {
    const renderer = await renderScreen();
    const deleteButton = findDeleteButton(renderer);

    await act(async () => {
      deleteButton!.props.onPress();
    });

    const alertCall = jest.mocked(Alert.alert).mock.calls[0];
    expect(alertCall[0]).toBe("Excluir escala");
    expect(alertCall[1]).toContain("atribuições relacionadas");
    const cancel = (alertCall[2] as any[])[0];
    cancel.onPress?.();

    expect(deleteScheduleMock).not.toHaveBeenCalled();
  });

  it("exclui com sucesso e redireciona", async () => {
    const renderer = await renderScreen();

    await act(async () => {
      findDeleteButton(renderer)!.props.onPress();
    });
    const confirm = (jest.mocked(Alert.alert).mock.calls[0][2] as any[])[1];

    await act(async () => {
      await confirm.onPress();
    });

    expect(deleteScheduleMock).toHaveBeenCalledWith("schedule-1");
    expect(Alert.alert).toHaveBeenCalledWith("Escala excluída", "A escala foi removida das listas ativas.");
    expect(replaceMock).toHaveBeenCalledWith("/schedules");
  });

  it("mostra erro quando API falha", async () => {
    deleteScheduleMock.mockRejectedValueOnce(new Error("Falha da API"));
    const renderer = await renderScreen();

    await act(async () => {
      findDeleteButton(renderer)!.props.onPress();
    });
    const confirm = (jest.mocked(Alert.alert).mock.calls[0][2] as any[])[1];

    await act(async () => {
      await confirm.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith("Erro", "Falha da API");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
