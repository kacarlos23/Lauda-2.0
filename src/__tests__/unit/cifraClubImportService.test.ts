import { NotFoundError, ServiceUnavailableError, ValidationError } from "../../errors/AppError";
import { CifraClubImportService } from "../../services/cifraClubImportService";
import { cifraClubSearchSchema } from "../../validators/song.schema";
import { promises as fs } from "node:fs";

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

const currentSongHtml = `
  <html>
    <head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":["MusicRecording","Article"],"name":"Aline Barros - Autor da Vida","byArtist":{"@type":"MusicGroup","name":"Aline Barros"}}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"MusicComposition","name":"Autor da Vida"}
      </script>
    </head>
    <body>
      <h2 class="u-srOnly">Menu principal</h2>
      <a href="/academy/">Academy</a>
      <h1>Autor da Vida</h1>
      <h2>Aline Barros</h2>
      <div>Tom<!-- -->:<!-- --> <button>F#<!-- --> (com forma de D)</button></div>
      <pre>[Intro] D9  F#m  G

D9
  Conteúdo de teste com acordes
      </pre>
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
  it("não expõe download vazio após a revisão de caracteres invisíveis", async () => {
    const service = new CifraClubImportService();
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    const page = { goto: jest.fn().mockResolvedValue({ status: () => 200, ok: () => true }), url: () => "https://www.cifraclub.com.br/aline-barros/autor-da-vida/", content: jest.fn().mockResolvedValue(songHtml) };
    const launch = jest.spyOn(CifraClubImportService as any, "launchBrowser").mockResolvedValue(browser);
    const newPage = jest.spyOn(CifraClubImportService as any, "newPage").mockResolvedValue(page);
    const download = jest.spyOn(service as any, "tryDownloadContent").mockResolvedValue("\u200B\u2060\uFEFF");
    try {
      const result = await service.import(page.url());
      expect(result.source).toBe("page-fallback");
      expect(result.content).toContain("[Intro] G  D/F#  Em");
      expect(result.content).not.toMatch(/[\u200B\u2060\uFEFF]/);
    } finally { launch.mockRestore(); newPage.mockRestore(); download.mockRestore(); }
  });
  it("preserva colunas de elementos inline e limpa invisíveis sem remover os espaços iniciais", () => {
    const html = songHtml.replace(/<pre>[\s\S]*?<\/pre>/, "<pre>\n\u200b    <span>G</span>  <b>D/F#</b>\n&#8203;G\tC\nTexto &lt;editado&gt;<br>Outra linha\n\n</pre>");
    const imported = CifraClubImportService.parseSongPage(html, "https://www.cifraclub.com.br/aline-barros/autor-da-vida/");
    expect(imported.content).toBe("    G  D/F#\nG       C\nTexto <editado>\nOutra linha");
  });
  afterEach(() => jest.restoreAllMocks());

  const modernCard = (artist: string, slug: string, title: string, key = "") => `
    <a href="/${slug}/cancao/">
      <div><p class="label primaryLabel">${title}</p>
      <span class="label secondaryLabel"><span>${artist}</span></span></div>
      ${key ? `<span class="tertiaryLabel">${key}</span>` : ""}
      <button title="Opções"><span>Opções</span></button>
    </a>`;

  function mockSearchBrowser(pages: string[], pagination = false) {
    let current = 0;
    const next = { count: jest.fn().mockResolvedValue(1), isDisabled: jest.fn().mockResolvedValue(false), click: jest.fn(async () => { current++; }) };
    const navigation = { count: jest.fn().mockResolvedValue(pagination ? 1 : 0), getByRole: jest.fn(() => next) };
    const page = {
      goto: jest.fn().mockResolvedValue({ status: () => 200, ok: () => true }),
      waitForSelector: jest.fn().mockResolvedValue({}),
      waitForFunction: jest.fn().mockResolvedValue({}),
      content: jest.fn(async () => pages[current]),
      url: () => "https://www.cifraclub.com.br/?q=cancao",
      getByRole: jest.fn(() => navigation),
      locator: jest.fn(() => ({ allTextContents: jest.fn().mockResolvedValue([]) })),
    };
    const browser = { close: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(CifraClubImportService as any, "launchBrowser").mockResolvedValue(browser);
    jest.spyOn(CifraClubImportService as any, "newPage").mockResolvedValue(page);
    return { page, browser, next };
  }

  it("lê os cartões atuais sem misturar título, artista, tom e botão de opções", () => {
    const html = modernCard("João &amp; Maria", "joao-e-maria", "Can&#231;&#227;o de Comunh&atilde;o", "Bb");
    expect(CifraClubImportService.parseSearchResults(html, "https://www.cifraclub.com.br/?q=cancao", { title: "Canção" }))
      .toEqual([{ title: "Canção de Comunhão", artist: "João & Maria", originalKey: "A#", url: "https://www.cifraclub.com.br/joao-e-maria/cancao/" }]);
  });

  it("preserva o título com acentos e o tom no catálogo de artista redirecionado", () => {
    const html = modernCard("", "oficina-g3", "A Lição", "Ab").replace(/<span class="label secondaryLabel">[\s\S]*?<\/span><\/span>/, "");
    const results = CifraClubImportService.parseSearchResults(html, "https://www.cifraclub.com.br/explorar/musicas/?artist=oficina-g3", { artist: "Oficina G3" });
    expect(results[0]).toMatchObject({ title: "A Lição", originalKey: "G#" });
  });

  it("consulta e pagina a busca atual sem depender das classes do Google CSE", async () => {
    const mock = mockSearchBrowser([modernCard("João", "joao", "Canção"), modernCard("Maria", "maria", "Canção")], true);
    const { items } = await new CifraClubImportService().search({ title: "Canção" });
    expect(items.map(item => item.artist)).toEqual(["João", "Maria"]);
    expect(mock.next.click).toHaveBeenCalledTimes(1);
    expect(mock.browser.close).toHaveBeenCalledTimes(1);
  });

  it("distingue ausência real de resultados de falha na consulta externa", async () => {
    const mock = mockSearchBrowser(['<main><h2>Nenhum resultado</h2></main>']);
    await expect(new CifraClubImportService().search({ title: "Inexistente" })).rejects.toBeInstanceOf(NotFoundError);
    mock.page.waitForSelector.mockRejectedValueOnce(new Error("Timeout"));
    await expect(new CifraClubImportService().search({ title: "Canção" })).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(mock.browser.close).toHaveBeenCalledTimes(2);
  });

  it("mantém resultados já encontrados se a próxima página falhar", async () => {
    const mock = mockSearchBrowser([modernCard("João", "joao", "Canção")], true);
    mock.next.click.mockRejectedValueOnce(new Error("Timeout"));
    await expect(new CifraClubImportService().search({ title: "Canção" })).resolves.toMatchObject({ items: [{ title: "Canção", artist: "João" }] });
  });

  it("não insere quebras em spans, preserva espaços e decodifica letras sem interpretá-las como HTML", () => {
    const html = `<h1>Canção</h1><h2>Artista</h2><p>Tom: C</p>
      <pre data-chord-content="true"><div>\u200b<span><b>C</b>    <b>G/B</b></span>\n</div><div><span>  Cora&#231;&#227;o &lt;3</span> &amp; f&eacute;\n\n</div><div><span><b>Am</b></span>\n</div></pre>`;
    const result = CifraClubImportService.parseSongPage(html, "https://www.cifraclub.com.br/artista/cancao/");
    expect(result.content).toBe("C    G/B\n  Coração <3 & fé\n\nAm");
  });

  it("importa o bloco da cifra e conserva a instrução de capotraste junto dos acordes originais", () => {
    const html = `<h1>Canção</h1><h2>Artista</h2><p>Tom: C</p>
      <button data-anchor="--chord-tone">F# (com forma de D)</button>
      <button data-anchor="--chord-capo">4ª casa</button>
      <pre>Conteúdo de outro componente</pre><pre data-chord-content="true">D9  F#m\nCanção</pre>`;
    expect(CifraClubImportService.parseSongPage(html, "https://www.cifraclub.com.br/artista/cancao/"))
      .toMatchObject({ originalKey: "F#", content: "Capotraste: 4ª casa\n\nD9  F#m\nCanção" });
  });

  it("classifica falha de navegação na importação como indisponibilidade e fecha o navegador", async () => {
    const mock = mockSearchBrowser([]);
    mock.page.goto.mockRejectedValueOnce(new Error("Timeout"));
    await expect(new CifraClubImportService().import("https://www.cifraclub.com.br/artista/cancao/"))
      .rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(mock.browser.close).toHaveBeenCalledTimes(1);
  });

  it.each([Buffer.from("%PDF-1.7"), Buffer.from([0xff, 0xfe, 0x80]), Buffer.from("<html>Erro externo</html>")])(
    "usa a página quando o download não é texto UTF-8 da cifra (%s)", async bytes => {
      const service = new CifraClubImportService() as any;
      const page = {
        getByText: () => ({ first: () => ({ count: async () => 1, click: async () => undefined }) }),
        isClosed: () => false,
        waitForEvent: async () => ({ path: async () => "temporary-download" }),
      };
      jest.spyOn(fs, "readFile").mockResolvedValue(bytes);
      await expect(service.tryDownloadContent(page)).resolves.toBeNull();
    }
  );
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

  it("suporta o layout atual com JSON-LD, headings de navegação e Tom separado por comentários", () => {
    const result = CifraClubImportService.parseSongPage(
      currentSongHtml,
      "https://www.cifraclub.com.br/aline-barros/autor-da-vida/"
    );

    expect(result).toMatchObject({
      title: "Autor da Vida",
      artist: "Aline Barros",
      originalKey: "F#",
      cifraUrl: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/",
      source: "page-fallback",
    });
    expect(result.content).toContain("[Intro] D9  F#m  G");
    expect(result.content).toContain("Conteúdo de teste com acordes");
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

  it("reconhece URLs de versões atuais e o Tom próximo mesmo com separadores no HTML", () => {
    const results = CifraClubImportService.parseSearchResults(
      `<a href="/aline-barros/autor-da-vida/sghzkgs.html">Autor da Vida - Aline Barros - Cifra Club</a>
       <div>Tom<!-- -->:<!-- --> <button>F#</button></div>`,
      "https://www.cifraclub.com.br/?q=autor%20da%20vida",
      { artist: "Aline Barros", title: "Autor da Vida" }
    );

    expect(results).toEqual([expect.objectContaining({
      title: "Autor da Vida",
      artist: "Aline Barros",
      originalKey: "F#",
      url: "https://www.cifraclub.com.br/aline-barros/autor-da-vida/sghzkgs.html",
    })]);
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

  it.each([403, 429, 500, 503])("classifica HTTP %s do Cifra Club como indisponibilidade externa", (status) => {
    const response = { status: () => status };
    const serviceClass = CifraClubImportService as unknown as {
      assertExternalServiceAvailable(response: unknown): void;
    };

    expect(() => serviceClass.assertExternalServiceAvailable(response)).toThrow(ServiceUnavailableError);
  });

  it.each([200, 404])("não classifica HTTP %s como bloqueio do serviço externo", (status) => {
    const response = { status: () => status };
    const serviceClass = CifraClubImportService as unknown as {
      assertExternalServiceAvailable(response: unknown): void;
    };

    expect(() => serviceClass.assertExternalServiceAvailable(response)).not.toThrow();
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

