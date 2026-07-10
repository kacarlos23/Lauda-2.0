import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import MinistriesScreen from "../../app/(tabs)/ministries";

type TestNode = TestRenderer.ReactTestInstance;

type MinistryStoreState = {
  ministries: any[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  fetchMinistries: jest.Mock;
  setRefreshing: jest.Mock;
  createMinistry: jest.Mock;
  clearError: jest.Mock;
};

let ministryState: MinistryStoreState;

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    ActivityIndicator: create("ActivityIndicator"),
    FlatList: ({ data, ListHeaderComponent, ListEmptyComponent, renderItem, refreshControl, ...props }: any) =>
      React.createElement(
        "FlatList",
        { ...props, refreshControl },
        typeof ListHeaderComponent === "function" ? React.createElement(ListHeaderComponent) : ListHeaderComponent,
        data?.length
          ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id ?? index }, renderItem({ item, index })))
          : typeof ListEmptyComponent === "function"
            ? React.createElement(ListEmptyComponent)
            : ListEmptyComponent
      ),
    Modal: ({ children, visible, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    RefreshControl: create("RefreshControl"),
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
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
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock("../../src/components/BottomSheet", () => {
  const React = require("react");
  return {
    BottomSheet: ({ children, footer }: any) => React.createElement("BottomSheet", null, children, footer),
  };
});

jest.mock("../../src/store/authStore", () => ({
  useAuthStore: () => ({ user: { role: "TENANT_ADMIN" } }),
}));

jest.mock("../../src/store/ministryStore", () => ({
  useMinistryStore: Object.assign(() => ministryState, {
    getState: () => ministryState,
  }),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { Plus: Icon, Search: Icon, SlidersHorizontal: Icon, X: Icon };
});

const originalConsoleError = console.error;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setup(overrides: Partial<MinistryStoreState>) {
  ministryState = {
    ministries: [],
    loading: false,
    error: null,
    refreshing: false,
    fetchMinistries: jest.fn(),
    setRefreshing: jest.fn(),
    createMinistry: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
}

async function renderScreen() {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<MinistriesScreen />);
  });
  return renderer!;
}

function textContent(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAllByType(Text).map((node: TestNode) => node.props.children).flat().join(" ");
}

describe("MinistriesScreen states", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalConsoleError(...args);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("renderiza loading inicial padronizado", async () => {
    setup({ loading: true });

    expect(textContent(await renderScreen())).toContain("Carregando minist");
  });

  it("renderiza erro da API com acao de retry", async () => {
    setup({ error: "Falha especifica da API" });
    const text = textContent(await renderScreen());

    expect(text).toContain("Falha especifica da API");
    expect(text).toContain("Tentar novamente");
  });

  it("renderiza vazio com titulo, descricao e acao", async () => {
    setup({});
    const text = textContent(await renderScreen());

    expect(text).toContain("Nenhum minist");
    expect(text).toContain("Crie o primeiro minist");
    expect(text).toContain("Criar minist");
  });
});
