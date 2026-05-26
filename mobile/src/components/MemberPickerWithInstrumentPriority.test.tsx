import React from "react";
import { Member } from "../types";
import { MemberPickerWithInstrumentPriority } from "./MemberPickerWithInstrumentPriority";

jest.mock("react-native", () => {
  const React = require("react");
  return {
    FlatList: ({ data, renderItem, keyExtractor, ...props }: any) =>
      React.createElement(
        "FlatList",
        props,
        data.map((item: any, index: number) =>
          React.cloneElement(renderItem({ item, index }), { key: keyExtractor(item, index) })
        )
      ),
    StyleSheet: { create: (styles: any) => styles },
    Text: ({ children, ...props }: any) => React.createElement("Text", props, children),
    TouchableOpacity: ({ children, ...props }: any) => React.createElement("TouchableOpacity", props, children),
    View: ({ children, ...props }: any) => React.createElement("View", props, children),
    Platform: { select: (values: any) => values.default },
  };
});

function makeMember(name: string, instruments: Array<{ id: string; name: string; colorHex?: string | null }> = []): Member {
  return {
    id: name.toLowerCase(),
    name,
    email: `${name.toLowerCase()}@example.com`,
    role: "MEMBER",
    tenantId: "tenant-1",
    instruments,
    ministries: [],
  };
}

function textContent(node: any): string {
  node = renderTree(node);
  if (typeof node === "string") return node;
  if (!node?.props?.children) return "";
  return React.Children.toArray(node.props.children).map(textContent).join("");
}

function renderTree(node: any): any {
  if (!node || typeof node === "string") return node;
  if (typeof node.type === "function") {
    return renderTree(node.type(node.props));
  }
  return node;
}

function collect(node: any, type: string): any[] {
  node = renderTree(node);
  if (!node) return [];
  const children = React.Children.toArray(node.props?.children);
  const current = node.type === type ? [node] : [];
  return current.concat(children.flatMap((child) => collect(child, type)));
}

describe("MemberPickerWithInstrumentPriority", () => {
  it("membros compativeis aparecem primeiro", () => {
    const element = MemberPickerWithInstrumentPriority({
      members: [makeMember("Bruno"), makeMember("Ana", [{ id: "keys", name: "Teclado" }])],
      roleText: "tecladista",
      selectedMemberId: null,
      onSelect: jest.fn(),
    }) as React.ReactElement;

    const rows = collect(element, "TouchableOpacity");

    expect(textContent(rows[0])).toContain("Ana");
    expect(textContent(rows[0])).toContain("Compatível");
  });

  it("membros sem instrumento continuam visiveis", () => {
    const element = MemberPickerWithInstrumentPriority({
      members: [makeMember("Ana", [{ id: "keys", name: "Teclado" }]), makeMember("Bruno")],
      roleText: "teclado",
      selectedMemberId: null,
      onSelect: jest.fn(),
    }) as React.ReactElement;

    expect(textContent(element)).toContain("Bruno");
    expect(textContent(element)).toContain("Nenhum instrumento informado");
  });

  it("selecao chama onSelect", () => {
    const onSelect = jest.fn();
    const member = makeMember("Ana", [{ id: "keys", name: "Teclado" }]);
    const element = MemberPickerWithInstrumentPriority({
      members: [member],
      roleText: "teclado",
      selectedMemberId: null,
      onSelect,
    }) as React.ReactElement;

    collect(element, "TouchableOpacity")[0].props.onPress();

    expect(onSelect).toHaveBeenCalledWith(member);
  });

  it("badges de instrumentos aparecem", () => {
    const element = MemberPickerWithInstrumentPriority({
      members: [makeMember("Ana", [{ id: "keys", name: "Teclado", colorHex: "#2563EB" }])],
      roleText: "teclado",
      selectedMemberId: null,
      onSelect: jest.fn(),
    }) as React.ReactElement;

    expect(textContent(element)).toContain("Teclado");
  });
});
