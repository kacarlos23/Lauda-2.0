import { ValidationError } from "../../errors/AppError";
import { CifraClubImportService } from "../../services/cifraClubImportService";
import { cifraClubSearchSchema } from "../../validators/song.schema";

const songHtml = `
  <html>
    <body>
      <h1>Autor da Vida</h1>
      <h2><a href="/aline-barros/">Aline Barros</a></h2>
      <p>tom: Bb (forma dos acordes no tom de G)</p>
      <pre>
        [Intro] G  D/F#  Em

        G
          Letra da música
        D
          Com acordes
      </pre>
      <button>Baixar cifra</button>
    </body>
  </html>
`;

const searchHtml = `
  <html>
    <body>
      <a href="/letra/A/">Letra A</a>
      <a href="/aline-barros/autor-da-vida/">01 Autor da Vida</a>
      <span>Aline Barros</span>
      <span>Tom F#</span>
      <a href="/outra-banda/outra-musica/">Outra Música</a>
    </body>
  </html>
`;

describe("CifraClubImportService", () => {
  it("extrai metadados e cifra pública da página", () => {
    const result = CifraClubImportService.parseSongPage(songHtml, "https://www.cifraclub.com.br/aline-barros/autor-da-vida/");

    expect(result).toMatchObject({
      title: "Autor da Vida",
      artist: "Aline Barros",
      originalKey: "A#",
      cifraUrl: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
      source: "page-fallback",
    });
    expect(result.content).toContain("[Intro] G  D/F#  Em");
    expect(result.content).toContain("Letra da música");
  });

  it("retorna candidatos compatíveis da busca", () => {
    const result = CifraClubImportService.parseSearchResults(
      searchHtml,
      "https://www.cifraclub.com.br/busca/?q=autor%20da%20vida",
      { artist: "Aline Barros", title: "Autor da Vida" }
    );

    expect(result[0]).toMatchObject({
      title: "Autor da Vida",
      artist: "Aline Barros",
      url: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
    });
    expect(result).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "https://www.cifraclub.com.br/letra/A/" }),
    ]));
  });

  it("aceita artista ou título separadamente e rejeita busca vazia", () => {
    expect(cifraClubSearchSchema.parse({ artist: " Aline Barros " })).toEqual({ artist: "Aline Barros" });
    expect(cifraClubSearchSchema.parse({ title: " Autor da Vida " })).toEqual({ title: "Autor da Vida" });
    expect(cifraClubSearchSchema.parse({ artist: "Aline Barros", title: "Autor da Vida" })).toEqual({
      artist: "Aline Barros",
      title: "Autor da Vida",
    });
    expect(() => cifraClubSearchSchema.parse({ artist: " ", title: "" })).toThrow("Informe o artista ou o nome da música");
  });

  it("lista todas as músicas compatíveis quando somente o artista é informado", () => {
    const catalogHtml = `
      <a href="/aline-barros/autor-da-vida/"><p>Autor da Vida</p></a>
      <a href="/aline-barros/ressuscita-me/"><p>Ressuscita-me</p></a>
      <a href="/aline-barros/10000-razones/"><p>10.000 Razones</p></a>
      <a href="/outra-banda/autor-da-vida/"><p>Autor da Vida</p></a>
    `;
    const results = CifraClubImportService.parseSearchResults(
      catalogHtml,
      "https://www.cifraclub.com.br/aline-barros/musicas.html?order=alphabetical",
      { artist: "Aline Barros" }
    );

    expect(results.map((item) => item.title)).toEqual(["10.000 Razones", "Autor da Vida", "Ressuscita-me"]);
    expect(results.every((item) => item.artist === "Aline Barros")).toBe(true);
  });

  it("filtra por título sem exigir artista e ordena a correspondência exata primeiro", () => {
    const googleHtml = `
      <a href="/oficina-g3/autor-da-vida/">Autor da Vida - Oficina G3 - Cifra Club</a>
      <a href="/aline-barros/autor-da-vida-acustico/">Autor da Vida Acústico - Aline Barros - Cifra Club</a>
      <a href="/oficina-g3/autor-da-vida/">Autor da Vida - Oficina G3 - Cifra Club</a>
      <a href="/outra-banda/cancao-diferente/">Canção Diferente - Outra Banda - Cifra Club</a>
    `;
    const results = CifraClubImportService.parseSearchResults(
      googleHtml,
      "https://www.cifraclub.com.br/?q=autor%20da%20vida",
      { title: "Autor da Vida" }
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ title: "Autor da Vida", artist: "Oficina G3" });
    expect(results[1]).toMatchObject({ title: "Autor da Vida Acústico", artist: "Aline Barros" });
  });

  it("exige compatibilidade com artista e título quando ambos são informados", () => {
    const googleHtml = `
      <a href="/aline-barros/autor-da-vida/">Autor da Vida - Aline Barros - Cifra Club</a>
      <a href="/oficina-g3/autor-da-vida/">Autor da Vida - Oficina G3 - Cifra Club</a>
      <a href="/aline-barros/ressuscita-me/">Ressuscita-me - Aline Barros - Cifra Club</a>
    `;
    const results = CifraClubImportService.parseSearchResults(
      googleHtml,
      "https://www.cifraclub.com.br/?q=aline%20barros%20autor%20da%20vida",
      { artist: "Aline Barros", title: "Autor da Vida" }
    );

    expect(results).toEqual([
      expect.objectContaining({ title: "Autor da Vida", artist: "Aline Barros" }),
    ]);
  });

  it("falha sem preencher dados parciais quando layout não tem cifra", () => {
    expect(() => CifraClubImportService.parseSongPage("<html></html>", "https://www.cifraclub.com.br/a/b/"))
      .toThrow(ValidationError);
  });
  it("ignora falha do download sem gerar rejeicao nao tratada", async () => {
    const service = new CifraClubImportService() as unknown as {
      tryDownloadContent(page: unknown): Promise<string | null>;
    };
    const downloadError = new Error("Target page, context or browser has been closed");
    const page = {
      getByText: () => ({
        first: () => ({
          count: jest.fn().mockResolvedValue(1),
          click: jest.fn().mockRejectedValue(downloadError),
        }),
      }),
      isClosed: () => false,
      waitForEvent: jest.fn().mockReturnValue(Promise.reject(downloadError)),
    };

    await expect(service.tryDownloadContent(page)).resolves.toBeNull();
  });
});
