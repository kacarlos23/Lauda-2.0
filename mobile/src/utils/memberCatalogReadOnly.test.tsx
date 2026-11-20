import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

type Role = "TENANT_ADMIN" | "MEMBER";

let currentRole: Role = "MEMBER";
const listArtistsMock = jest.fn();
const loadInstrumentsMock = jest.fn();

jest.mock("react-native", () => {
  const ReactLib = require("react");
  const create = (type: string) => ({ children, ...props }: any) =>
    ReactLib.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Image: create("Image"),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    ScrollView: create("ScrollView"),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style ?? {}),
    },
    Text: create("Text"),
    TextInput: create("TextInput"),
    TouchableOpacity: create("TouchableOpacity"),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    View: create("View"),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const ReactLib = require("react");
  return {
    SafeAreaView: ({ children, ...props }: any) => ReactLib.createElement("SafeAreaView", props, children),
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  };
});

jest.mock("expo-router", () => {
  const ReactLib = require("react");
  return {
    Redirect: ({ href }: { href: string }) => ReactLib.createElement("Redirect", { href }),
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  };
});

jest.mock("lucide-react-native", () => {
  const ReactLib = require("react");
  const Icon = (props: any) => ReactLib.createElement("Icon", props);
  return {
    Edit3: Icon,
    Plus: Icon,
    Save: Icon,
    Trash2: Icon,
    UserRound: Icon,
    X: Icon,
  };
});

jest.mock("../components/AppBackButton", () => ({
  AppBackButton: () => null,
}));

jest.mock("../components/ui/InputControl", () => {
  const ReactLib = require("react");
  return {
    InputControl: (props: any) => ReactLib.createElement("TextInput", props),
  };
});

jest.mock("../components/instruments/InstrumentBadge", () => {
  const ReactLib = require("react");
  const { Text: RNText } = require("react-native");
  return {
    InstrumentBadge: ({ instrument }: { instrument: { name: string } }) =>
      ReactLib.createElement(RNText, null, instrument.name),
  };
});

jest.mock("../components/instruments/InstrumentAppearanceEditor", () => ({
  InstrumentAppearanceEditor: () => null,
}));

jest.mock("../components/ui", () => {
  const ReactLib = require("react");
  const { Text: RNText, TouchableOpacity: RNTouchableOpacity, View: RNView } = require("react-native");
  return {
    AppInput: ({ label, ...props }: any) => ReactLib.createElement(RNView, props, ReactLib.createElement(RNText, null, label)),
    Button: ({ title, onPress, ...props }: any) =>
      ReactLib.createElement(RNTouchableOpacity, { onPress, ...props }, ReactLib.createElement(RNText, null, title)),
    EmptyState: ({ title, description }: any) =>
      ReactLib.createElement(RNView, null, ReactLib.createElement(RNText, null, title), ReactLib.createElement(RNText, null, description)),
    ErrorBanner: ({ message }: any) => (message ? ReactLib.createElement(RNText, null, message) : null),
    FilterButton: () => null,
    FilterPanel: ({ children }: any) => ReactLib.createElement(RNView, null, children),
    LoadingState: ({ message }: any) => ReactLib.createElement(RNText, null, message ?? "Carregando"),
    PageHeader: ({ title, subtitle }: any) =>
      ReactLib.createElement(RNView, null, ReactLib.createElement(RNText, null, title), ReactLib.createElement(RNText, null, subtitle)),
    Screen: ({ children, ...props }: any) => ReactLib.createElement(RNView, props, children),
    SearchField: (props: any) => ReactLib.createElement("SearchField", props),
    Toolbar: ({ children }: any) => ReactLib.createElement(RNView, null, children),
  };
});

jest.mock("../store/authStore", () => ({
  useAuthStore: (selector?: (state: { user: { id: string; role: Role } }) => unknown) => {
    const state = { user: { id: "user-1", role: currentRole } };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

jest.mock("../services/musicService", () => ({
  musicService: {
    listArtists: (...args: unknown[]) => listArtistsMock(...args),
    updateArtist: jest.fn(),
  },
}));

jest.mock("../store/instrumentStore", () => ({
  useInstrumentStore: () => ({
    instruments: [{ id: "inst-1", name: "Violão", colorHex: null, iconKey: null }],
    loading: false,
    saving: false,
    deletingId: null,
    error: null,
    clearError: jest.fn(),
    createInstrument: jest.fn(),
    deleteInstrument: jest.fn(),
    loadInstruments: loadInstrumentsMock,
    updateInstrument: jest.fn(),
  }),
}));

import ArtistsScreen from "../../app/(tabs)/artists";
import InstrumentCatalogScreen from "../../app/(tabs)/instruments";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat()
    .join(" ");
}

describe("catálogos de Artistas e Instrumentos em modo somente leitura para MEMBER", () => {
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
    currentRole = "MEMBER";
    listArtistsMock.mockResolvedValue({
      items: [{ id: "artist-1", name: "Diante do Trono", imageUrl: null }],
    });
  });

  it("permite visualizar Artistas sem botões de edição para MEMBER e exibe edição para TENANT_ADMIN", async () => {
    jest.useFakeTimers();
    let memberRenderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      memberRenderer = TestRenderer.create(<ArtistsScreen />);
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(memberRenderer.root.findAllByType("Redirect" as any)).toHaveLength(0);
    expect(textContent(memberRenderer)).toContain("Diante do Trono");
    expect(textContent(memberRenderer)).toContain("Consulte os artistas cadastrados");
    expect(
      memberRenderer.root.findAll((node) => node.props.accessibilityLabel === "Editar Diante do Trono")
    ).toHaveLength(0);

    currentRole = "TENANT_ADMIN";
    let adminRenderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      adminRenderer = TestRenderer.create(<ArtistsScreen />);
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      adminRenderer.root.findAll((node) => node.props.accessibilityLabel === "Editar Diante do Trono").length
    ).toBeGreaterThan(0);
    jest.useRealTimers();
  });

  it("permite visualizar Instrumentos/Cargos sem formulário ou ações destrutivas para MEMBER e exibe ações para TENANT_ADMIN", async () => {
    let memberRenderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      memberRenderer = TestRenderer.create(<InstrumentCatalogScreen />);
    });

    expect(loadInstrumentsMock).toHaveBeenCalledTimes(1);
    expect(memberRenderer.root.findAllByType("Redirect" as any)).toHaveLength(0);
    expect(textContent(memberRenderer)).toContain("Violão");
    expect(textContent(memberRenderer)).toContain("Consulte os instrumentos e cargos");
    expect(memberRenderer.root.findAll((node) => node.props.testID === "instrument-name-input")).toHaveLength(0);
    expect(memberRenderer.root.findAll((node) => node.props.testID === "instrument-edit-inst-1")).toHaveLength(0);
    expect(memberRenderer.root.findAll((node) => node.props.testID === "instrument-delete-inst-1")).toHaveLength(0);

    currentRole = "TENANT_ADMIN";
    let adminRenderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      adminRenderer = TestRenderer.create(<InstrumentCatalogScreen />);
    });

    expect(adminRenderer.root.findAll((node) => node.props.testID === "instrument-name-input").length).toBeGreaterThan(0);
    expect(adminRenderer.root.findAll((node) => node.props.testID === "instrument-edit-inst-1").length).toBeGreaterThan(0);
    expect(adminRenderer.root.findAll((node) => node.props.testID === "instrument-delete-inst-1").length).toBeGreaterThan(0);
  });
});
