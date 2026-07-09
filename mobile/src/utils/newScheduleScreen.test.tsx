import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import NewScheduleScreen from "../../app/(tabs)/schedules/new";

type TestNode = TestRenderer.ReactTestInstance;

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Modal: ({ visible, children, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Platform: { select: (values: any) => values.web ?? values.default },
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
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return {
    ArrowLeft: Icon,
    Calendar: Icon,
    Clock: Icon,
  };
});

jest.mock("../../src/components/AppBackButton", () => ({
  AppBackButton: () => null,
}));

jest.mock("../../src/components/ArtistPicker", () => ({
  ArtistPicker: () => null,
}));

jest.mock("../../src/store/authStore", () => ({
  useAuthStore: (selector: any) => selector({ user: { id: "admin-1", role: "TENANT_ADMIN" } }),
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

  it("abre criação rápida de música por cima do modal de seleção e mantém botões com mesmo estilo base", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<NewScheduleScreen />);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const addSongsButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Adicionar m"));
    expect(addSongsButton).toBeTruthy();

    await act(async () => {
      addSongsButton!.props.onPress();
    });

    const quickSongButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("+ Adicionar"));
    expect(quickSongButton).toBeTruthy();

    await act(async () => {
      quickSongButton!.props.onPress();
    });

    const allTexts = renderer!.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
    expect(allTexts).toContain("Adicionar m");

    const cancelButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Cancelar"));
    const createButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => flattenText(node).includes("Criar e adicionar"));

    expect(cancelButton?.props.style).toMatchObject({ flex: 1, minHeight: 48, maxWidth: 220 });
    expect(createButton?.props.style[0]).toMatchObject({ flex: 1, minHeight: 48, maxWidth: 220 });

    const modals = renderer!.root.findAll((node: TestNode) => String(node.type) === "Modal");
    expect(flattenText(modals[modals.length - 1])).toContain("Adicionar m");
  });
});
