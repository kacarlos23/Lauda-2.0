import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TouchableOpacity } from "react-native";
import SchedulesScreen from "../../app/(tabs)/schedules";
import { musicService } from "../services/musicService";
import { scheduleService } from "../services/scheduleService";

type TestNode = TestRenderer.ReactTestInstance;

const pushMock = jest.fn();

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    FlatList: ({ data, renderItem, ListHeaderComponent, ListEmptyComponent, ...props }: any) => React.createElement(
      "FlatList",
      props,
      <>
        {typeof ListHeaderComponent === "function" ? <ListHeaderComponent /> : ListHeaderComponent}
        {data?.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id ?? index }, renderItem({ item, index }))) : ListEmptyComponent}
      </>
    ),
    Modal: ({ children, visible, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Pressable: ({ children, style, ...props }: any) => React.createElement("Pressable", { ...props, style: typeof style === "function" ? style({ hovered: false, pressed: false }) : style }, children),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    RefreshControl: create("RefreshControl"),
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { CalendarClock: Icon, Copy: Icon, Download: Icon, Edit3: Icon, Plus: Icon, Search: Icon, SlidersHorizontal: Icon, X: Icon };
});

jest.mock("../services/scheduleService", () => ({
  scheduleService: {
    exportScheduleReport: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../services/musicService", () => ({
  musicService: {
    exportSongs: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    tenant: { id: "tenant-1", name: "Igreja Teste" },
    user: { id: "admin-1", role: "TENANT_ADMIN" },
  }),
}));

const today = new Date();

jest.mock("../store/scheduleStore", () => ({
  useScheduleStore: () => ({
    allSchedules: [{
      id: "schedule-1",
      title: "Culto relatório",
      date: today.toISOString(),
      ministryId: "ministry-1",
      tenantId: "tenant-1",
      ministry: { id: "ministry-1", name: "Louvor" },
      songs: [
        { id: "ss-1", scheduleId: "schedule-1", songId: "song-1", order: 1, song: { id: "song-1", title: "Senhor Tu És Bom", originalKey: "G", artistId: "artist-1", artist: { id: "artist-1", name: "Vineyard" } } },
        { id: "ss-2", scheduleId: "schedule-1", songId: "song-2", order: 0, song: { id: "song-2", title: "Bondade de Deus", originalKey: "A", artistId: "artist-2", artist: { id: "artist-2", name: "Isaías Saad" } } },
      ],
      assignments: [{ id: "assignment-1", scheduleId: "schedule-1", userId: "user-1", role: "Vocal", status: "PENDING", user: { id: "user-1", name: "Carlos" } }],
    }],
    schedules: [],
    loading: false,
    refreshing: false,
    error: null,
    loadSchedules: jest.fn(),
    loadMySchedules: jest.fn(),
    updateScheduleStatus: jest.fn(),
    createSchedule: jest.fn(),
    resolveSubstitution: jest.fn(),
  }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

describe("SchedulesScreen report button", () => {
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
  });

  it("gera relatório ao clicar no botão do card sem navegar para edição", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<SchedulesScreen />);
    });

    const reportButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Gerar relatório da escala Culto relatório");

    expect(reportButton).toBeTruthy();

    await act(async () => {
      await reportButton!.props.onPress();
    });

    expect(scheduleService.exportScheduleReport).toHaveBeenCalledWith(
      "schedule-1",
      expect.stringMatching(/^Escala - Culto relatório - \d{4}-\d{2}-\d{2}\.pdf$/),
      expect.objectContaining({ id: "schedule-1", title: "Culto relatório" })
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("exporta as cifras na ordem da escala sem navegar para edição", async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SchedulesScreen />);
    });
    const songsButton = renderer!.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Exportar cifras da escala Culto relatório");

    await act(async () => {
      await songsButton!.props.onPress();
    });

    expect(musicService.exportSongs).toHaveBeenCalledWith(
      ["song-2", "song-1"],
      expect.stringMatching(/^Cifras - Culto relatório - \d{4}-\d{2}-\d{2}\.pdf$/)
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
