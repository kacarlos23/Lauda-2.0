import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TouchableOpacity } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { SONG_TRANSFER_FIELDS } from "../../../../src/constants/songTransferFields";
import { SongDataTransferPanel } from "./SongDataTransferPanel";
import { musicService, SongTransferDocument, SongTransferPreview } from "../../services/musicService";
import { ministryApi } from "../../services/ministryApi";
import { Button, ConfirmDialog, ErrorBanner } from "../ui";

jest.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    ActivityIndicator: component("ActivityIndicator"),
    Alert: { alert: jest.fn() },
    Modal: ({ visible, children }: any) => visible ? React.createElement("Modal", null, children) : null,
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    Pressable: component("Pressable"),
    StyleSheet: { create: (styles: any) => styles },
    Text: component("Text"),
    TouchableOpacity: component("TouchableOpacity"),
    View: component("View"),
  };
});
jest.mock("lucide-react-native", () => ({ CheckCircle2: () => null, Download: () => null, Upload: () => null }));
jest.mock("../BottomSheet", () => ({ BottomSheet: ({ isOpen, children, footer }: any) => isOpen ? <>{children}{footer}</> : null }));
jest.mock("../ui", () => ({
  Button: jest.requireActual("../ui/Button").Button,
  Chip: jest.requireActual("../ui/Chip").Chip,
  ConfirmDialog: jest.requireActual("../ui/ConfirmDialog").ConfirmDialog,
  ErrorBanner: () => null,
  LoadingState: () => null,
}));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../../services/ministryApi", () => ({ ministryApi: { getMinistries: jest.fn() } }));
jest.mock("../../services/musicService", () => ({ musicService: {
  previewSongData: jest.fn(), commitSongData: jest.fn(), exportSongData: jest.fn(),
} }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const document: SongTransferDocument = {
  format: "lauda.music-catalog", version: 1,
  songs: [{ title: "Canção de Louvor", artist: "JMM", originalKey: "A", content: "A D E" }],
};
const preview: SongTransferPreview = {
  documentHash: "a".repeat(64), total: 1, unique: 1,
  counts: { CREATE: 1, UPDATE: 0, LINK: 0, RESTORE: 0, ALREADY_LINKED: 0, SKIPPED: 0, CONFLICT: 0, INVALID: 0 },
  items: [{ index: 0, title: document.songs[0].title, artist: "JMM", status: "CREATE" }],
};

describe("SongDataTransferPanel", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const onImported = jest.fn();
  const onClose = jest.fn();
  const render = async () => {
    await act(async () => {
      renderer = TestRenderer.create(<SongDataTransferPanel visible canImport canExport onImported={onImported} onClose={onClose} />);
    });
  };
  const button = (title: string) => renderer.root.findAllByType(Button).find((node) => node.props.title === title)!;
  const selectFile = async () => { await act(async () => button("Selecionar arquivo").props.onPress()); };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ministryApi.getMinistries).mockResolvedValue([{ id: "ministry-a", name: "Louvor" }] as any);
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false, assets: [{ uri: "blob:catalog", name: "catalog.json", file: { text: async () => JSON.stringify(document) } }],
    } as any);
    jest.mocked(musicService.previewSongData).mockResolvedValue(preview);
    jest.mocked(musicService.commitSongData).mockResolvedValue({
      created: 1, linked: 1, restored: 0, alreadyLinked: 0, conflicts: 0, invalid: 0, total: 1, documentHash: preview.documentHash,
    });
    jest.mocked(musicService.exportSongData).mockResolvedValue();
  });
  beforeAll(() => {
    const originalError = console.error;
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      originalError(...args);
    });
  });
  afterAll(() => jest.restoreAllMocks());
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });

  it("confirma a importação no navegador e só envia depois da confirmação", async () => {
    await render();
    await selectFile();
    await act(async () => button("Importar 1 músicas").props.onPress());
    expect(musicService.commitSongData).not.toHaveBeenCalled();
    expect(renderer.root.findByType(ConfirmDialog).props.visible).toBe(true);
    await act(async () => renderer.root.findByType(ConfirmDialog).props.onConfirm());
    expect(musicService.commitSongData).toHaveBeenCalledWith("ministry-a", document, preview.documentHash, {
      fields: [...SONG_TRANSFER_FIELDS],
      existing: "create",
    });
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("aceita JSON com BOM e permite selecionar arquivos sem MIME JSON", async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
      canceled: false, assets: [{ uri: "blob:catalog", name: "catalog.json", mimeType: "text/plain", file: { text: async () => `\uFEFF${JSON.stringify(document)}` } }],
    } as any);
    await render();
    await selectFile();
    expect(musicService.previewSongData).toHaveBeenCalledWith("ministry-a", document, {
      fields: [...SONG_TRANSFER_FIELDS],
      existing: "create",
    });
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ type: expect.arrayContaining([".json", "text/plain"]) }));
  });

  it("cancela a confirmação sem importar e mantém a revisão", async () => {
    await render();
    await selectFile();
    await act(async () => button("Importar 1 músicas").props.onPress());
    await act(async () => renderer.root.findByType(ConfirmDialog).props.onCancel());
    expect(renderer.root.findAllByType(ConfirmDialog)).toHaveLength(0);
    expect(button("Importar 1 músicas")).toBeTruthy();
    expect(musicService.commitSongData).not.toHaveBeenCalled();
  });

  it("bloqueia troca de ministério, nova revisão e exportação enquanto revisa", async () => {
    jest.mocked(ministryApi.getMinistries).mockResolvedValue([
      { id: "ministry-a", name: "Manhã" }, { id: "ministry-b", name: "Noite" },
    ] as any);
    await render();
    await act(async () => renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityRole === "radio")!.props.onPress());
    let resolve!: (value: SongTransferPreview) => void;
    jest.mocked(musicService.previewSongData).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await selectFile();
    expect(button("Selecionar arquivo").props.disabled).toBe(true);
    expect(button("Exportar JSON").props.disabled).toBe(true);
    for (const node of renderer.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === "radio")) {
      expect(node.props.disabled).toBe(true);
    }
    await act(async () => resolve(preview));
  });

  it("exibe erro de JSON inválido sem enviar nada ao servidor", async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
      canceled: false, assets: [{ uri: "blob:broken", file: { text: async () => "{invalid" } }],
    } as any);
    await render();
    await selectFile();
    expect(renderer.root.findByType(ErrorBanner).props.message).toMatch(/JSON válido/);
    expect(musicService.previewSongData).not.toHaveBeenCalled();
  });

  it("ignora uma revisão antiga que termina depois de fechar e reabrir o painel", async () => {
    let resolve!: (value: SongTransferPreview) => void;
    jest.mocked(musicService.previewSongData).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await render();
    await selectFile();
    await act(async () => renderer.update(<SongDataTransferPanel visible={false} canImport canExport onImported={onImported} onClose={onClose} />));
    await act(async () => renderer.update(<SongDataTransferPanel visible canImport canExport onImported={onImported} onClose={onClose} />));
    await act(async () => resolve(preview));
    expect(button("Importar 1 músicas")).toBeUndefined();
    expect(musicService.commitSongData).not.toHaveBeenCalled();
  });

  it("cancelar a seleção de outro arquivo mantém a revisão anterior", async () => {
    await render();
    await selectFile();
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
    await selectFile();
    expect(button("Importar 1 músicas")).toBeTruthy();
    expect(musicService.previewSongData).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType(ErrorBanner).props.message).toBeNull();
  });

  it("filtra pendências e exibe o motivo por música", async () => {
    jest.mocked(musicService.previewSongData).mockResolvedValueOnce({
      ...preview, total: 2, unique: 2, counts: { ...preview.counts, CONFLICT: 1 },
      items: [...preview.items, { index: 1, title: "Conflitante", artist: "Artista", status: "CONFLICT", reason: "Tom diferente" }],
    });
    await render(); await selectFile();
    const text = () => JSON.stringify(renderer.toJSON());
    expect(text()).toContain("Conflitante");
    await act(async () => renderer.root.findAllByType(TouchableOpacity).filter((n) => n.props.accessibilityRole === "tab")[1].props.onPress());
    expect(text()).not.toContain("Conflitante");
    await act(async () => renderer.root.findAllByType(TouchableOpacity).filter((n) => n.props.accessibilityRole === "tab")[2].props.onPress());
    expect(text()).toContain("Tom diferente");
  });

  it("bloqueia cliques repetidos antes da atualização da tela", async () => {
    await render();
    let done!: (value: any) => void;
    jest.mocked(DocumentPicker.getDocumentAsync).mockReturnValueOnce(new Promise((resolve) => { done = resolve; }));
    const click = button("Selecionar arquivo").props.onPress;
    await act(async () => { void click(); void click(); });
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1);
    await act(async () => done({ canceled: true, assets: null }));
  });
});
