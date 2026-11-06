import { Schedule } from "../types";
import { worshipItems, withWorshipItems, worshipOrderText } from "./worshipOrderItems";

const schedule = {
  id: "schedule", title: "Celebração especial", songs: [
    { songId: "a", order: 0, moment: "Prelúdio", song: { title: "Primeira música", artist: { name: "Artista cadastrado" } } },
    { songId: "b", order: 1, moment: "Outro", momentDescription: "Bênção", song: { title: "Última música" } },
  ], readings: [{ id: "reading", text: "João 3:16\n\nPorque Deus amou o mundo.  ", position: 1 }],
} as Schedule;
describe("sequência e texto da ordem de culto", () => {
  it("intercala e reordena leituras sem perder conteúdo nem ordem das músicas", () => {
    const items = worshipItems(schedule);
    expect(items.map((item) => item.kind)).toEqual(["song", "reading", "song"]);
    const reordered = withWorshipItems(schedule, [items[1], items[0], items[2]]);
    expect(reordered.readings).toEqual([{ ...schedule.readings![0], position: 0 }]);
    expect(reordered.songs?.map((s) => s.songId)).toEqual(["a", "b"]);
    expect(worshipItems(reordered).map((item) => item.kind)).toEqual(["reading", "song", "song"]);
  });
  it("formata o título da escala, músicas com artista e momento e linhas da leitura entre asteriscos", () => {
    expect(worshipOrderText({ morning: null, evening: schedule })).toBe(
      "=== Celebração especial ===\n- Primeira música (Artista cadastrado) · Prelúdio\n- Leitura bíblica:\n*João 3:16*\n\n*Porque Deus amou o mundo.*\n- Última música · Bênção");
  });
  it("aceita ordens antigas e mantém leituras após remoção de músicas em outra tela", () => {
    expect(worshipItems({ songs: schedule.songs }).map((item) => item.kind)).toEqual(["song", "song"]);
    expect(worshipItems({ songs: [], readings: schedule.readings })).toEqual([{ kind: "reading", entry: schedule.readings![0] }]);
  });
});
