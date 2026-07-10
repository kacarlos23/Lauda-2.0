import React from "react";
import {
  AppInput,
  Button,
  EmptyState,
  ErrorBanner,
  FilterButton,
  FilterPanel,
  ScheduleStatusBadge,
  getInviteStatusBadge,
  getRoleBadge,
  getScheduleStatusBadge,
} from ".";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    ActivityIndicator: (props: any) => React.createElement("ActivityIndicator", props),
    Modal: ({ children, visible, ...props }: any) => visible ? React.createElement("Modal", props, children) : null,
    Platform: { select: (values: any) => values.web ?? values.default },
    ScrollView: ({ children, ...props }: any) => React.createElement("ScrollView", props, children),
    StyleSheet: { create: (styles: any) => styles },
    Text: ({ children, ...props }: any) => React.createElement("Text", props, children),
    TextInput: (props: any) => React.createElement("TextInput", props),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement("TouchableOpacity", props, children),
    View: ({ children, ...props }: any) => React.createElement("View", props, children),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { SlidersHorizontal: Icon, X: Icon };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaView: ({ children, ...props }: any) => React.createElement("SafeAreaView", props, children),
  };
});

function renderTree(node: any): any {
  if (!node || typeof node === "string") return node;
  if (typeof node.type === "function") return renderTree(node.type(node.props));
  return node;
}

function collect(node: any, type: string): any[] {
  node = renderTree(node);
  if (!node) return [];
  const children = React.Children.toArray(node.props?.children);
  const current = node.type === type ? [node] : [];
  return current.concat(children.flatMap((child) => collect(child, type)));
}

function textContent(node: any): string {
  node = renderTree(node);
  if (typeof node === "string") return node;
  if (!node?.props?.children) return "";
  return React.Children.toArray(node.props.children).map(textContent).join("");
}

describe("ui components", () => {
  it("Button preserva acessibilidade e dispara onPress", () => {
    const onPress = jest.fn();
    const element = <Button title="Salvar" accessibilityLabel="Salvar alterações" onPress={onPress} />;
    const button = collect(element, "TouchableOpacity")[0];

    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Salvar alterações");
    button.props.onPress();
    expect(onPress).toHaveBeenCalled();
    expect(textContent(element)).toContain("Salvar");
  });

  it("Button em loading desabilita toque e mostra indicador", () => {
    const element = <Button title="Salvar" loading />;
    const button = collect(element, "TouchableOpacity")[0];

    expect(button.props.disabled).toBe(true);
    expect(collect(element, "ActivityIndicator")).toHaveLength(1);
  });

  it("ErrorBanner renderiza apenas com mensagem", () => {
    expect(ErrorBanner({ message: null })).toBeNull();

    const element = <ErrorBanner message="Falha ao carregar" testID="error" />;
    expect(collect(element, "Text")[0].props.accessibilityRole).toBe("alert");
    expect(textContent(element)).toContain("Falha ao carregar");
  });

  it("AppInput renderiza label e repassa props de acessibilidade", () => {
    const element = <AppInput label="E-mail" value="" accessibilityLabel="Campo de e-mail" />;

    expect(textContent(element)).toContain("E-mail");
    expect(collect(element, "TextInput")[0].props.accessibilityLabel).toBe("Campo de e-mail");
  });

  it("EmptyState renderiza título e descrição", () => {
    const element = <EmptyState title="Nada aqui" description="Tente novamente mais tarde." />;

    expect(textContent(element)).toContain("Nada aqui");
    expect(textContent(element)).toContain("Tente novamente mais tarde.");
  });

  it("FilterButton preserva acessibilidade e dispara abertura", () => {
    const onPress = jest.fn();
    const element = <FilterButton active onPress={onPress} accessibilityLabel="Abrir filtros de teste" />;
    const button = collect(element, "TouchableOpacity")[0];

    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Abrir filtros de teste");
    button.props.onPress();
    expect(onPress).toHaveBeenCalled();
  });

  it("FilterPanel desabilita busca sem campos preenchidos", () => {
    const element = (
      <FilterPanel visible title="Filtros" canApply={false} onApply={jest.fn()} onClose={jest.fn()}>
        <AppInput label="Palavra-chave geral" value="" />
      </FilterPanel>
    );
    const searchButton = collect(element, "TouchableOpacity")
      .find((button) => button.props.accessibilityLabel === "Aplicar filtros");

    expect(textContent(element)).toContain("Palavra-chave geral");
    expect(searchButton?.props.disabled).toBe(true);
  });

  it("StatusBadge renderiza status de escala e mapeia tons principais", () => {
    const element = <ScheduleStatusBadge status="ACCEPTED" />;

    expect(textContent(element)).toContain("Aceita");
    expect(getScheduleStatusBadge("PENDING")).toMatchObject({ label: "Pendente", tone: "warning" });
    expect(getScheduleStatusBadge("ACCEPTED")).toMatchObject({ label: "Aceita", tone: "success" });
    expect(getScheduleStatusBadge("DECLINED")).toMatchObject({ label: "Recusada", tone: "danger" });
  });

  it("StatusBadge mapeia papeis e convites sem usar uma cor unica", () => {
    expect(getRoleBadge("GLOBAL_ADMIN")).toMatchObject({ label: "Admin global", tone: "info" });
    expect(getRoleBadge("TENANT_ADMIN")).toMatchObject({ label: "Admin da igreja", tone: "primary" });
    expect(getRoleBadge("MINISTRY_LEADER")).toMatchObject({ label: "L\u00edder", tone: "success" });
    expect(getRoleBadge("MEMBER")).toMatchObject({ label: "Membro", tone: "neutral" });
    expect(getInviteStatusBadge(true)).toMatchObject({ label: "Convite ativo", tone: "success" });
    expect(getInviteStatusBadge(false)).toMatchObject({ label: "Convite inativo", tone: "danger" });
  });

  it("StatusBadge usa neutro para status desconhecido", () => {
    expect(getScheduleStatusBadge("CANCELLED")).toMatchObject({ label: "Cancelled", tone: "neutral" });
    expect(getRoleBadge("OWNER")).toMatchObject({ label: "Owner", tone: "neutral" });
  });});
