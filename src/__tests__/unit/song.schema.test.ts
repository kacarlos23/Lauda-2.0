import { songListSchema, songTagsSchema } from "../../validators/song.schema";

describe("song list tag filters", () => {
  it("aceita um tema, parâmetros repetidos ou lista separada por vírgula", () => {
    expect(songListSchema.parse({ tags: "Natal" }).tags).toEqual(["Natal"]);
    expect(songListSchema.parse({ tags: ["Natal", " Adoração ", "adoração"] }).tags).toEqual(["Natal", "Adoração"]);
    expect(songListSchema.parse({ tags: "Natal, Adoração" }).tags).toEqual(["Natal", "Adoração"]);
    expect(songListSchema.parse({}).tags).toBeUndefined();
    expect(songListSchema.parse({ tags: "" }).tags).toBeUndefined();
    expect(songListSchema.parse({ tags: " , " }).tags).toBeUndefined();
  });

  it("aceita mais filtros de tema do que uma única música pode receber", () => {
    const tags = Array.from({ length: 13 }, (_, index) => `Tema ${index}`);
    expect(songListSchema.parse({ tags, untagged: "true" })).toMatchObject({ tags, untagged: true });
    expect(songTagsSchema.safeParse(tags).success).toBe(false);
    expect(() => songListSchema.parse({ tags: "a".repeat(41) })).toThrow();
    expect(() => songListSchema.parse({ untagged: "1" })).toThrow();
  });
});
