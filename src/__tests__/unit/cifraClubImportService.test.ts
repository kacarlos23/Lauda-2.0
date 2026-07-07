import { ValidationError } from "../../errors/AppError";
import { CifraClubImportService } from "../../services/cifraClubImportService";

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
