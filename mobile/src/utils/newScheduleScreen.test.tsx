import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TextInput, TouchableOpacity } from "react-native";
import NewScheduleScreen from "../../app/(tabs)/schedules/new";
import { musicService } from "../services/musicService";

type TestNode = TestRenderer.ReactTestInstance;
let currentRole = "TENANT_ADMIN";
let routeParams: { date?: string } = {};

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Modal: ({ visible, children, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Dimensions: { get: () => ({ width: 1024, height: 768 }) },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
    Platform: { select: (values: any) => values.web ?? values.default },
    Pressable: create("Pressable"),
    ScrollView: create("ScrollView"),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useLocalSearchParams: () => routeParams,
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return {
    ArrowLeft: Icon,
    Calendar: Icon,
    Clock: Icon,
    Search: Icon,
  };
});

jest.mock("../../src/components/AppBackButton", () => ({
  AppBackButton: () => null,
}));

jest.mock("../../src/components/ArtistPicker", () => ({
  ArtistPicker: () => null,
}));

jest.mock("../../src/store/authStore", () => ({
  useAuthStore: (selector: any) => selector({ user: { id: "admin-1", role: currentRole } }),
}));

jest.mock("../../src/store/scheduleStore", () => ({
  useScheduleStore: () => ({ createSchedule: jest.fn(), saving: false, error: null }),
}));

jest.mock("../../src/services/ministryApi", () => ({
  ministryApi: {
    getMinistries: jest.fn(() => Promise.resolve([{ id: "ministry-1", name: "Louvor", tenantId: "tenant-1", createdAt: "" }])),
    listMembers: jest.fn(() => Promise.resolve({ items: [] })),
  },
}));

jest.mock("../../src/services/memberService", () => ({
  memberService: {
    listMembers: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock("../../src/services/musicService", () => ({
  musicService: {
    listSongs: jest.fn(() => Promise.resolve({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } })),
    createSong: jest.fn(),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function flattenText(node: TestNode) {
  return node.findAllByType(Text).map((text: TestNode) => text.props.children).flat().join(" ");
}

async function renderNewScheduleScreen() {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<NewScheduleScreen />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer!;
}

describe("NewScheduleScreen", () => {
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
    routeParams = {};
    jest.mocked(musicService.listSongs).mockResolvedValue({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
  });

  it("bloqueia usuario comum na rota administrativa de criacao", async () => {
    currentRole = "MEMBER";
    const renderer = await renderNewScheduleScreen();

    const text = renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
    expect(text).toContain("permiss");
  });
  it("usa a data selecionada no calendario como valor inicial", async () => {
    routeParams = { date: "2026-07-15" };
    const renderer = await renderNewScheduleScreen();

    const dateInput = renderer.root.findByProps({ testID: "schedule-date" });
    expect(dateInput.props.value).toBe("15/07/2026");

    const allTexts = renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
    expect(allTexts).not.toContain("Calendário");
  });

  it("fecha calendario e seletor de horario ao tocar fora", async () => {
    const renderer = await renderNewScheduleScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: "schedule-date-picker" }).props.onPress();
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Fechar calendário" }).length).toBeGreaterThan(0);

    await act(async () => {
      renderer.root.findAllByProps({ accessibilityLabel: "Fechar calendário" })[0].props.onPress();
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Fechar calendário" })).toHaveLength(0);

    await act(async () => {
      renderer.root.findByProps({ testID: "schedule-time-picker" }).props.onPress();
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Fechar seletor de horário" }).length).toBeGreaterThan(0);

    await act(async () => {
      renderer.root.findAllByProps({ accessibilityLabel: "Fechar seletor de horário" })[0].props.onPress();
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: "Fechar seletor de horário" })).toHaveLength(0);
  });

  it("abre criação rápida de música por cima do modal de seleção e mantém botões com mesmo estilo base", async () => {
    const renderer = await renderNewScheduleScreen();

    const addSongsButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Adicionar m"));
    expect(addSongsButton).toBeTruthy();

    await act(async () => {
      addSongsButton!.props.onPress();
    });

    const quickSongButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("+ Adicionar"));
    expect(quickSongButton).toBeTruthy();

    await act(async () => {
      quickSongButton!.props.onPress();
    });

    const allTexts = renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
    expect(allTexts).toContain("Adicionar m");

    const cancelButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Cancelar"));
    const createButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Criar e adicionar"));

    expect(cancelButton?.props.style).toMatchObject({ flex: 1, minHeight: 48, maxWidth: 220 });
    expect(createButton?.props.style[0]).toMatchObject({ flex: 1, minHeight: 48, maxWidth: 220 });

    const modals = renderer.root.findAll((node: TestNode) => String(node.type) === "Modal");
    expect(flattenText(modals[modals.length - 1])).toContain("Adicionar m");
  });

  it("busca músicas por título ou artista no seletor da escala", async () => {
    const result = {
      id: "song-1",
      title: "Bondade de Deus",
      originalKey: "A",
      artistId: "artist-1",
      artist: { id: "artist-1", name: "Isaías Saad", imageUrl: null },
      content: "[A]Bondade",
      createdAt: "",
      updatedAt: "",
    } as any;
    jest.mocked(musicService.listSongs).mockResolvedValue({ items: [result], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    const renderer = await renderNewScheduleScreen();
    const addSongsButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Adicionar m"));

    await act(async () => {
      addSongsButton!.props.onPress();
    });
    act(() => {
      renderer.root.findByProps({ testID: "schedule-song-search-input" }).props.onChangeText("Isaías Saad");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(musicService.listSongs).toHaveBeenCalledWith("Isaías Saad", 1, 100);
    expect(flattenText(renderer.root)).toContain("Bondade de Deus");
    act(() => renderer.unmount());
  });
});
