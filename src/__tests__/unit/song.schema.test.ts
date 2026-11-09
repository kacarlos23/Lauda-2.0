import { songListSchema } from "../../validators/song.schema";

describe("song list tag filters", () => {
  it("aceita um tema, parâmetros repetidos ou lista separada por vírgula", () => {
    expect(songListSchema.parse({ tags: "Natal" }).tags).toEqual(["Natal"]);
    expect(songListSchema.parse({ tags: ["Natal", " Adoração ", "adoração"] }).tags).toEqual(["Natal", "Adoração"]);
    expect(songListSchema.parse({ tags: "Natal, Adoração" }).tags).toEqual(["Natal", "Adoração"]);
    expect(songListSchema.parse({}).tags).toBeUndefined();
    expect(songListSchema.parse({ tags: "" }).tags).toBeUndefined();
    expect(songListSchema.parse({ tags: " , " }).tags).toBeUndefined();
  });

  it("rejeita tema longo demais ou além do limite", () => {
    expect(() => songListSchema.parse({ tags: "a".repeat(41) })).toThrow();
    expect(() => songListSchema.parse({ tags: Array.from({ length: 13 }, (_, index) => `Tema ${index}`) })).toThrow();
  });
});
