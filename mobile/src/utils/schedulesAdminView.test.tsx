import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TouchableOpacity } from "react-native";
import SchedulesScreen from "../../app/(tabs)/schedules";

type Role = "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";
type TestNode = TestRenderer.ReactTestInstance;

const pushMock = jest.fn();
const loadSchedulesMock = jest.fn();
const loadMySchedulesMock = jest.fn();
const updateScheduleStatusMock = jest.fn();
const createScheduleMock = jest.fn();
const resolveSubstitutionMock = jest.fn();
let currentRole: Role = "MEMBER";

function permissionsForRole(role: Role): string[] {
  switch (role) {
    case "TENANT_ADMIN":
      return ["schedule:create", "schedule:view", "schedule:edit"];
    case "MINISTRY_LEADER":
      return ["schedule:create", "schedule:view", "schedule:edit"];
    default:
      return [];
  }
}

const futureDate = new Date().toISOString();
const schedule = {
  id: "schedule-1",
  title: "Culto teste",
  date: futureDate,
  ministryId: "ministry-1",
  tenantId: "tenant-1",
  ministry: { id: "ministry-1", name: "Louvor" },
  assignments: [{ id: "assignment-1", scheduleId: "schedule-1", userId: "user-1", role: "Vocal", status: "PENDING", user: { id: "user-1", name: "Ana" } }],
  songs: [],
};
const assignment = {
  id: "assignment-1",
  scheduleId: "schedule-1",
  userId: "user-1",
  role: "Vocal",
  status: "PENDING",
  schedule,
};

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Image: create("Image"),
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
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    View: create("View"),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock("../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    screenWidth: 390,
    screenHeight: 844,
  }),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { CalendarClock: Icon, ChevronDown: Icon, ChevronUp: Icon, Copy: Icon, Download: Icon, Edit3: Icon, Music2: Icon, Plus: Icon, Search: Icon, SlidersHorizontal: Icon, Trash2: Icon, X: Icon };
});

jest.mock("../services/scheduleService", () => ({
  scheduleService: { exportScheduleReport: jest.fn(() => Promise.resolve()) },
}));

jest.mock("../services/musicService", () => ({
  musicService: { exportSongs: jest.fn(() => Promise.resolve()) },
}));

jest.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    tenant: { id: "tenant-1", name: "Igreja Teste" },
    user: { id: "user-1", role: currentRole, permissions: permissionsForRole(currentRole) },
  }),
}));

jest.mock("../store/scheduleStore", () => ({
  useScheduleStore: () => ({
    allSchedules: [schedule],
    schedules: [assignment],
    loading: false,
    refreshing: false,
    error: null,
    loadSchedules: loadSchedulesMock,
    loadMySchedules: loadMySchedulesMock,
    updateScheduleStatus: updateScheduleStatusMock,
    createSchedule: createScheduleMock,
    resolveSubstitution: resolveSubstitutionMock,
  }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

async function renderScreen(role: Role) {
  currentRole = role;
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SchedulesScreen />);
  });
  return renderer!;
}

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
}

describe("SchedulesScreen visao administrativa", () => {
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

  it("membro comum ve apenas suas escalas e nao ve acoes administrativas", async () => {
    const renderer = await renderScreen("MEMBER");
    const text = textContent(renderer);

    expect(loadSchedulesMock).not.toHaveBeenCalled();
    expect(loadMySchedulesMock).toHaveBeenCalled();
    expect(text).not.toContain("Nova Escala");
    expect(text).not.toContain("Editar");
    expect(text).not.toContain("Duplicar");
    expect(text).toContain("Aceitar");
    expect(text).toContain("Recusar");
  });

  it("lider ve acoes administrativas de escala", async () => {
    const renderer = await renderScreen("MINISTRY_LEADER");
    const text = textContent(renderer);

    expect(loadSchedulesMock).toHaveBeenCalled();
    expect(text).toContain("Nova Escala");
    expect(text).toContain("Editar");
    expect(text).toContain("Duplicar");
  });

  it("admin pode acionar edicao e duplicacao", async () => {
    const renderer = await renderScreen("TENANT_ADMIN");
    const editButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Editar escala Culto teste");
    const duplicateButton = renderer.root.findAllByType(TouchableOpacity)
      .find((node: TestNode) => node.props.accessibilityLabel === "Duplicar escala Culto teste");

    expect(editButton).toBeTruthy();
    expect(duplicateButton).toBeTruthy();

    await act(async () => {
      editButton!.props.onPress();
      await duplicateButton!.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith({
      pathname: "/schedules/[id]/edit",
      params: { id: "schedule-1" },
    });
    expect(createScheduleMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Copia de Culto teste",
      ministryId: "ministry-1",
    }));
  });
});
