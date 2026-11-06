import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import WorshipOrderScreen from "../../app/(tabs)/schedules/worship-order";
import { Button } from "../components/ui/Button";
import { musicService } from "../services/musicService";
import { worshipOrderService } from "../services/worshipOrderService";

let dirty = false;
let permissions: string[];
jest.mock("react-native", () => {
  const React = require("react");
  const component = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    View: component("View"), Text: component("Text"), TouchableOpacity: component("TouchableOpacity"),
    ScrollView: component("ScrollView"), ActivityIndicator: component("ActivityIndicator"),
    Platform: { OS: "web", select: (values: any) => values.web ?? values.default },
    Modal: () => null, StyleSheet: { create: (styles: any) => styles },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useLocalSearchParams: () => ({ date: "2026-11-08" }),
  useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]),
}));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("../components/ui", () => ({
  Button: jest.requireActual("../components/ui/Button").Button,
  Screen: ({ children }: any) => <>{children}</>, AppInput: () => null,
  ErrorBanner: ({ message }: any) => message ? <span>{message}</span> : null,
}));
jest.mock("../components/DateTimeInput", () => ({ DateTimeInput: () => null }));
jest.mock("../components/schedules/ScheduleSongCard", () => ({ ScheduleSongCard: () => null }));
jest.mock("../components/schedules/ScheduleWorshipFields", () => ({ ScheduleParticipationFields: () => null }));
jest.mock("../components/schedules/SortableSongList", () => ({ SortableSongList: () => null }));
jest.mock("../components/schedules/WorshipReadingCard", () => ({ WorshipReadingCard: () => null }));
jest.mock("../hooks/useFormExit", () => ({ useFormExit: () => ({ dirty, dialog: null, reset: jest.fn(), complete: jest.fn() }) }));
jest.mock("../store/authStore", () => ({ useAuthStore: () => ({ user: { id: "user", role: "MEMBER", permissions } }) }));
jest.mock("../services/musicService", () => ({ musicService: { exportSongs: jest.fn() } }));
jest.mock("../services/scheduleService", () => ({ scheduleService: { listSchedules: async () => [] } }));
jest.mock("../services/worshipOrderService", () => ({ worshipOrderService: { get: jest.fn() } }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const entry = (songId: string, order: number) => ({ songId, order, song: { title: songId } });
const order = { morning: { songs: [entry("b", 1), entry("a", 0)] }, evening: { songs: [entry("b", 0), entry("c", 1)] } } as any;
let renderer: TestRenderer.ReactTestRenderer;
async function render() {
  await act(async () => { renderer = TestRenderer.create(<WorshipOrderScreen />); });
}
const action = () => renderer.root.findAllByType(Button).find((node) => node.props.title === "Gerar PDF das cifras");

beforeEach(() => {
  jest.clearAllMocks(); dirty = false;
  permissions = ["schedule:view", "schedule:edit", "schedule:view_reports", "song:view"];
  jest.mocked(worshipOrderService.get).mockResolvedValue(order);
  jest.mocked(musicService.exportSongs).mockResolvedValue(undefined);
});
afterEach(() => { if (renderer) act(() => renderer.unmount()); });

it("exporta manhã e noite na sequência salva, sem repetir cifras nem usar o título da ordem", async () => {
  await render();
  expect(action()?.props.disabled).toBe(false);
  await act(async () => { action()!.props.onPress(); });
  expect(musicService.exportSongs).toHaveBeenCalledWith(["a", "b", "c"], "Cifras_08-11-2026.pdf");
});
it.each(["dirty", "empty", "permission"])("protege a exportação: %s", async (reason) => {
  if (reason === "dirty") dirty = true;
  if (reason === "empty") jest.mocked(worshipOrderService.get).mockResolvedValue({ morning: null, evening: null } as any);
  if (reason === "permission") permissions = permissions.filter((permission) => permission !== "song:view");
  await render();
  if (reason === "permission") expect(action()).toBeUndefined();
  else expect(action()?.props.disabled).toBe(true);
  expect(musicService.exportSongs).not.toHaveBeenCalled();
});
it("mostra falha de exportação e permite tentar novamente", async () => {
  jest.mocked(musicService.exportSongs).mockRejectedValueOnce(new Error("Falha ao gerar cifras"));
  await render();
  await act(async () => { action()!.props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain("Falha ao gerar cifras");
  expect(action()?.props.disabled).toBe(false);
});
it("recusa mais de 50 cifras antes de chamar a API", async () => {
  jest.mocked(worshipOrderService.get).mockResolvedValue({ morning: { songs: Array.from({ length: 51 }, (_, i) => entry(`song-${i}`, i)) }, evening: null } as any);
  await render();
  await act(async () => { action()!.props.onPress(); });
  expect(musicService.exportSongs).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain("É possível exportar até 50 músicas por PDF.");
});
