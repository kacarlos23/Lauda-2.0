import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MemberRoleSelector, hasIncompleteMemberRoles } from "./MemberRoleSelector";
import { ScheduleSongCard } from "./ScheduleSongCard";
import { Member, Song } from "../../types";

jest.mock("react-native", () => {
  const React = require("react");
  const create = (type: string) => ({ children, ...props }: any) => React.createElement(type, props, children);
  return {
    Image: create("Image"),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    StyleSheet: { create: (styles: any) => styles },
    Text: create("Text"),
    TouchableOpacity: create("TouchableOpacity"),
    View: create("View"),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const Icon = (props: any) => React.createElement("Icon", props);
  return { Check: Icon, ChevronDown: Icon, ChevronUp: Icon, Music2: Icon, Trash2: Icon, UserRound: Icon, X: Icon };
});

const member: Member = {
  id: "member-1",
  name: "Ana",
  role: "MEMBER",
  tenantId: "tenant-1",
  ministries: [],
  instruments: [{ id: "instrument-1", name: "Vocal", colorHex: "#1F6F55" }],
};

function content(node: TestRenderer.ReactTestInstance): string {
  return node.children.map((child) => typeof child === "string" ? child : content(child)).join("");
}

describe("componentes de escala", () => {
  it("adiciona membro sem função automática e sinaliza pendência", () => {
    const onChange = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<MemberRoleSelector members={[member]} value={[]} onChange={onChange} />); });
    const add = renderer.root.find((node) => node.props.accessibilityLabel === "Adicionar Ana");
    act(() => add.props.onPress());
    expect(onChange).toHaveBeenCalledWith([{ userId: member.id, role: "" }]);
    expect(hasIncompleteMemberRoles(onChange.mock.calls[0][0])).toBe(true);
  });

  it("mantém função histórica identificada e indisponibiliza membro sem opções", () => {
    let historical!: TestRenderer.ReactTestRenderer;
    act(() => { historical = TestRenderer.create(<MemberRoleSelector members={[member]} value={[{ userId: member.id, role: "Violino" }]} onChange={jest.fn()} />); });
    expect(historical.root.findAllByType("Text" as any).map(content).join(" ")).toContain("Função histórica");

    const withoutRoles = { ...member, id: "member-2", name: "Bia", instruments: [] };
    let unavailable!: TestRenderer.ReactTestRenderer;
    act(() => { unavailable = TestRenderer.create(<MemberRoleSelector members={[withoutRoles]} value={[]} onChange={jest.fn()} />); });
    expect(unavailable.root.find((node) => node.props.accessibilityLabel === "Adicionar Bia").props.disabled).toBe(true);
    expect(unavailable.root.findAllByType("Text" as any).map(content).join(" ")).toContain("atualizar o perfil");
  });

  it("exibe card de música com posição, artista, tom e BPM e mantém ações independentes", () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    const song = {
      id: "song-1",
      title: "Graça",
      originalKey: "G",
      bpm: 72,
      artist: { id: "artist-1", name: "Banda", imageUrl: null },
    } as Pick<Song, "id" | "title" | "originalKey" | "bpm" | "artist">;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ScheduleSongCard song={song} position={2} onPress={onPress} onRemove={onRemove} />); });
    const texts = renderer.root.findAllByType("Text" as any).map(content).join(" ");
    expect(texts).toContain("02");
    expect(texts).toContain("Graça");
    expect(texts).toContain("Banda");
    expect(texts).toContain("Tom G");
    expect(texts).toContain("72 BPM");
    act(() => renderer.root.find((node) => node.props.accessibilityLabel === "Abrir cifra de Graça").props.onPress());
    act(() => renderer.root.find((node) => node.props.accessibilityLabel === "Remover Graça").props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
