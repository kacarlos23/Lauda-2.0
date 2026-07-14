import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Text, TouchableOpacity } from "react-native";
import EditScheduleScreen from "../../app/(tabs)/schedules/[id]/edit";
import { musicService } from "../../src/services/musicService";

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
    Pressable: create("Pressable"),
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
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
  return { ArrowLeft: Icon, Calendar: Icon, Clock: Icon, Download: Icon, Search: Icon, Trash2: Icon, X: Icon };
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

function findConfirmButton(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType(TouchableOpacity)
    .find((node: TestNode) => node.props.accessibilityLabel === "Confirmar exclusão da escala");
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
    (globalThis as any).window = { confirm: jest.fn() };
    jest.mocked(musicService.listSongs).mockResolvedValue({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
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

    expect(renderer.root.findByProps({ testID: "delete-schedule-modal" })).toBeTruthy();
    expect(textContent(renderer)).toContain("Culto exclusao");
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: "Manter escala" }).props.onPress();
    });

    expect(deleteScheduleMock).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: "delete-schedule-modal" })).toHaveLength(0);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("fecha o modal pelo ícone, fundo e ação de voltar", async () => {
    const renderer = await renderScreen();
    const open = async () => act(async () => findDeleteButton(renderer)!.props.onPress());

    await open();
    await act(async () => renderer.root.findByProps({ accessibilityLabel: "Fechar" }).props.onPress());
    expect(renderer.root.findAllByProps({ testID: "delete-schedule-modal" })).toHaveLength(0);

    await open();
    await act(async () => renderer.root.findByProps({ testID: "delete-schedule-modal-backdrop" }).props.onPress());
    expect(renderer.root.findAllByProps({ testID: "delete-schedule-modal" })).toHaveLength(0);

    await open();
    await act(async () => renderer.root.findByType("Modal" as any).props.onRequestClose());
    expect(renderer.root.findAllByProps({ testID: "delete-schedule-modal" })).toHaveLength(0);
  });

  it("exclui com sucesso e redireciona", async () => {
    const renderer = await renderScreen();

    await act(async () => {
      findDeleteButton(renderer)!.props.onPress();
    });
    await act(async () => {
      findConfirmButton(renderer)!.props.onPress();
      await Promise.resolve();
    });

    expect(deleteScheduleMock).toHaveBeenCalledWith("schedule-1");
    expect(replaceMock).toHaveBeenCalledWith("/schedules");
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("mostra erro quando API falha", async () => {
    deleteScheduleMock.mockRejectedValueOnce(new Error("Falha da API"));
    const renderer = await renderScreen();

    await act(async () => {
      findDeleteButton(renderer)!.props.onPress();
    });
    await act(async () => {
      findConfirmButton(renderer)!.props.onPress();
      await Promise.resolve();
    });

    expect(renderer.root.findByProps({ testID: "delete-schedule-error" })).toBeTruthy();
    expect(textContent(renderer)).toContain("Falha da API");
    expect(findConfirmButton(renderer)).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("bloqueia cliques duplicados enquanto exclui", async () => {
    let resolveDelete!: () => void;
    deleteScheduleMock.mockReturnValueOnce(new Promise<void>((resolve) => { resolveDelete = resolve; }));
    const renderer = await renderScreen();
    act(() => findDeleteButton(renderer)!.props.onPress());

    act(() => {
      findConfirmButton(renderer)!.props.onPress();
      findConfirmButton(renderer)!.props.onPress();
    });

    expect(deleteScheduleMock).toHaveBeenCalledTimes(1);
    expect(textContent(renderer)).toContain("Excluindo...");
    expect(findConfirmButton(renderer)!.props.disabled).toBe(true);

    await act(async () => resolveDelete());
  });

  it("busca músicas no seletor de edição da escala", async () => {
    const renderer = await renderScreen();
    const editSongsButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.findAllByType(Text).some((text: TestNode) => String(text.props.children).includes("Editar m")));

    await act(async () => {
      editSongsButton!.props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ testID: "schedule-song-search-input" }).props.onChangeText("Vineyard");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(musicService.listSongs).toHaveBeenCalledWith("Vineyard", 1, 100);
    act(() => renderer.unmount());
  });
});
