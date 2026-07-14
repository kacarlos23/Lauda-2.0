import { promises as fs } from "node:fs";
import { chromium, Download, Page } from "playwright";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { CifraClubSearchInput, MUSICAL_KEYS } from "../validators/song.schema";

const BASE_URL = "https://www.cifraclub.com.br";
const USER_AGENT = "LaudaApp/1.0 (+authorized-cifraclub-import)";

type MusicalKey = (typeof MUSICAL_KEYS)[number];

export type CifraClubSearchResult = {
  title: string;
  artist: string;
  url: string;
  originalKey?: string | null;
};

export type CifraClubImportResult = {
  title: string;
  artist: string;
  originalKey: MusicalKey;
  cifraUrl: string;
  content: string;
  source: "download" | "page-fallback";
};

export class CifraClubImportService {
  async search(input: CifraClubSearchInput): Promise<{ items: CifraClubSearchResult[] }> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ userAgent: USER_AGENT });
      const results = new Map<string, CifraClubSearchResult>();
      const merge = (items: CifraClubSearchResult[]) => items.forEach((item) => {
        const previous = results.get(item.url);
        results.set(item.url, previous
          ? { ...previous, originalKey: previous.originalKey ?? item.originalKey ?? null }
          : item);
      });

      let artistCatalogItems: CifraClubSearchResult[] = [];
      if (input.artist) {
        merge(await this.searchDirectCandidates(page, input));
        artistCatalogItems = await this.searchArtistSongs(page, input);
        merge(artistCatalogItems);
      }

      if (!input.artist || artistCatalogItems.length === 0) {
        merge(await this.searchGeneralCandidates(page, input));
      }

      const items = Array.from(results.values())
        .filter((candidate) => CifraClubImportService.matchesCandidate(candidate, input))
        .sort((first, second) => CifraClubImportService.compareCandidates(first, second, input));
      if (!items.length) throw new NotFoundError("Nenhuma cifra encontrada no Cifra Club para os termos informados.");
      return { items };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  async import(url: string): Promise<CifraClubImportResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ acceptDownloads: true, userAgent: USER_AGENT });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });

      const html = await page.content();
      const metadata = CifraClubImportService.parseSongPage(html, page.url());
      const downloadContent = await this.tryDownloadContent(page);

      return {
        ...metadata,
        content: downloadContent?.trim() || metadata.content,
        source: downloadContent?.trim() ? "download" : "page-fallback",
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private async tryDownloadContent(page: Page): Promise<string | null> {
    const downloadButton = page.getByText(/baixar cifra/i).first();
    if (!await downloadButton.count()) return null;

    if (page.isClosed()) return null;

    let downloadPromise: Promise<Download | null> | null = null;
    try {
      downloadPromise = page.waitForEvent("download", { timeout: 8_000 }).catch(() => null);
      await downloadButton.click({ timeout: 5_000 });
      const download = await downloadPromise;
      if (!download) return null;
      const filePath = await download.path();
      if (!filePath) return null;
      return await fs.readFile(filePath, "utf8");
    } catch {
      await downloadPromise?.catch(() => null);
      return null;
    }
  }

  private async searchDirectCandidates(page: Page, input: CifraClubSearchInput): Promise<CifraClubSearchResult[]> {
    const results = new Map<string, CifraClubSearchResult>();
    for (const url of CifraClubImportService.candidateSearchUrls(input)) {
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        if (!response?.ok() || !CifraClubImportService.isSongUrl(page.url())) continue;
        const html = await page.content();
        const parsed = CifraClubImportService.parseSongPage(html, page.url());
        if (!CifraClubImportService.matchesCandidate(parsed, input)) continue;
        results.set(parsed.cifraUrl, {
          title: parsed.title,
          artist: parsed.artist,
          url: parsed.cifraUrl,
          originalKey: parsed.originalKey,
        });
      } catch {
        // Um candidato direto pode não existir; as demais estratégias continuam normalmente.
      }
    }

    return Array.from(results.values())
      .sort((first, second) => CifraClubImportService.compareCandidates(first, second, input));
  }

  private async searchArtistSongs(page: Page, input: CifraClubSearchInput): Promise<CifraClubSearchResult[]> {
    if (!input.artist) return [];
    const artistPageUrl = CifraClubImportService.artistPageUrl(input.artist);
    if (!artistPageUrl) return [];

    try {
      const response = await page.goto(artistPageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      if (!response?.ok()) return [];
      return CifraClubImportService.parseSearchResults(await page.content(), page.url(), input);
    } catch {
      return [];
    }
  }

  private async searchGeneralCandidates(page: Page, input: CifraClubSearchInput): Promise<CifraClubSearchResult[]> {
    const query = [input.artist, input.title].filter(Boolean).join(" ");
    if (!query) return [];

    const results = new Map<string, CifraClubSearchResult>();
    try {
      await page.goto(`${BASE_URL}/?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForSelector(".gsc-webResult.gsc-result", { state: "attached", timeout: 12_000 });

      const collectCurrentPage = async () => {
        for (const item of CifraClubImportService.parseSearchResults(await page.content(), page.url(), input)) {
          const previous = results.get(item.url);
          results.set(item.url, previous
            ? { ...previous, originalKey: previous.originalKey ?? item.originalKey ?? null }
            : item);
        }
      };

      await collectCurrentPage();
      const pageNumbers = (await page.locator(".gsc-cursor-page").allTextContents())
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 1);

      for (const pageNumber of pageNumbers) {
        const cursor = page.locator(".gsc-cursor-page").filter({ hasText: new RegExp(`^${pageNumber}$`) }).first();
        if (!await cursor.count()) continue;
        try {
          await cursor.click({ timeout: 5_000 });
          await page.waitForFunction(
            (expectedPage) => document.querySelector(".gsc-cursor-current-page")?.textContent?.trim() === String(expectedPage),
            pageNumber,
            { timeout: 8_000 }
          );
          await collectCurrentPage();
        } catch {
          // Preserva as páginas já coletadas quando a paginação externa falha.
        }
      }
    } catch {
      return [];
    }

    return Array.from(results.values());
  }

  static parseSearchResults(html: string, currentUrl: string, input: CifraClubSearchInput): CifraClubSearchResult[] {
    const results = new Map<string, CifraClubSearchResult>();
    const currentSong = this.songCandidateFromUrl(currentUrl, html);
    if (currentSong) results.set(currentSong.url, currentSong);

    const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html))) {
      const url = this.absoluteCifraClubUrl(match[1]);
      if (!url || !this.isSongUrl(url)) continue;

      const text = this.cleanText(match[2]);
      const pathParts = new URL(url).pathname.split("/").filter(Boolean);
      const { artist, title } = this.candidateLabels(text, pathParts, currentUrl, input);

      if (!this.matchesCandidate({ title, artist }, input)) continue;
      const candidate = { title, artist, url, originalKey: this.findNearbyKey(html, match.index) };
      const previous = results.get(url);
      if (!previous || this.labelQuality(candidate) > this.labelQuality(previous)) {
        results.set(url, candidate);
      }
    }

    return Array.from(results.values())
      .sort((first, second) => this.compareCandidates(first, second, input));
  }

  static parseSongPage(html: string, pageUrl: string): CifraClubImportResult {
    const title = this.extractSongTitle(html, pageUrl);
    const artist = this.extractSongArtist(html, pageUrl);
    const keyText = this.cleanText(html).match(/\btom:\s*([A-G](?:#|b)?m?)/i)?.[1] ?? "";
    const originalKey = this.normalizeMusicalKey(keyText);
    const content = this.extractChordContent(html);

    if (!title || !artist || !originalKey || !content) {
      throw new ValidationError("Não foi possível importar a cifra. O layout do Cifra Club pode ter mudado.");
    }

    return {
      title,
      artist,
      originalKey,
      cifraUrl: pageUrl,
      content,
      source: "page-fallback",
    };
  }

  private static extractChordContent(html: string): string {
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch?.[1]) return this.cleanPreText(preMatch[1]);

    const text = this.cleanText(html)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    const start = text.search(/\btom:\s*[A-G](?:#|b)?m?/i);
    const end = text.search(/Repetir\s+Modo teatro|Fechar Miniplayer|Outros vídeos desta música/i);
    if (start < 0 || end <= start) return "";
    return text.slice(start, end).replace(/^tom:.*$/im, "").trim();
  }

  private static cleanPreText(value: string): string {
    return this.decodeEntities(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>|<\/p>|<\/span>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  private static cleanText(value: string): string {
    return this.decodeEntities(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>|<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static decodeEntities(value: string): string {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  private static firstMatch(html: string, regex: RegExp): string {
    const match = html.match(regex);
    return match?.[1] ? this.cleanText(match[1]) : "";
  }

  private static extractSongTitle(html: string, pageUrl: string): string {
    const headings = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi))
      .map((match) => this.cleanText(match[1]))
      .filter((value) => value && !/^cifra club$/i.test(value));
    if (headings[0]) return headings[0];

    const titleTag = this.firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
      .replace(/\s+-\s+.*$/, "")
      .trim();
    if (titleTag && !/^cifra club$/i.test(titleTag)) return titleTag;

    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    return this.titleCaseSlug(parts[1] ?? "");
  }

  private static extractSongArtist(html: string, pageUrl: string): string {
    const linkedHeading = this.firstMatch(html, /<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    if (linkedHeading) return linkedHeading;

    const heading = this.firstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (heading) return heading;

    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    return this.titleCaseSlug(parts[0] ?? "");
  }

  private static normalizeMusicalKey(value: string): MusicalKey | null {
    const normalized = value.trim();
    const flatMap: Record<string, MusicalKey> = {
      Db: "C#",
      Eb: "D#",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
      Dbm: "C#m",
      Ebm: "D#m",
      Gbm: "F#m",
      Abm: "G#m",
      Bbm: "A#m",
    };
    const candidate = flatMap[normalized] ?? normalized;
    return (MUSICAL_KEYS as readonly string[]).includes(candidate) ? candidate as MusicalKey : null;
  }

  private static absoluteCifraClubUrl(href: string): string | null {
    try {
      const url = new URL(href, BASE_URL);
      if (url.hostname !== "www.cifraclub.com.br") return null;
      url.hash = "";
      url.search = "";
      return url.toString();
    } catch {
      return null;
    }
  }

  private static candidateSearchUrls(input: CifraClubSearchInput): string[] {
    const artistSlug = this.slugify(input.artist ?? "");
    const titleSlug = this.slugify(input.title ?? "");
    if (!artistSlug || !titleSlug) return [];
    return [`${BASE_URL}/${artistSlug}/${titleSlug}/`];
  }

  private static artistPageUrl(artist: string): string | null {
    const artistSlug = this.slugify(artist);
    return artistSlug ? `${BASE_URL}/${artistSlug}/musicas.html?order=alphabetical` : null;
  }

  private static isSongUrl(url: string): boolean {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    if (parts[1].includes(".")) return false;
    const blockedSections = [
      "academy",
      "blog",
      "cifra",
      "estilos",
      "forum",
      "imprimir",
      "letra",
      "listas",
      "partitura",
      "partituras",
      "tablatura",
      "tablaturas",
      "tabs",
      "video",
      "videos",
    ];
    return !blockedSections.includes(parts[0].toLowerCase());
  }

  private static songCandidateFromUrl(url: string, html: string): CifraClubSearchResult | null {
    if (!this.isSongUrl(url)) return null;
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      title: this.extractSongTitle(html, url) || this.titleCaseSlug(parts[1]),
      artist: this.extractSongArtist(html, url) || this.titleCaseSlug(parts[0]),
      url: parsed.toString(),
      originalKey: this.firstMatch(html, /\btom:\s*([A-G](?:#|b)?m?)/i) || null,
    };
  }

  private static titleCaseSlug(value: string): string {
    return value
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  private static slugify(value: string): string {
    return this.normalize(value)
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private static candidateLabels(text: string, pathParts: string[], currentUrl: string, input: CifraClubSearchInput) {
    const fallbackTitle = this.titleCaseSlug(pathParts[1] ?? input.title ?? "");
    const fallbackArtist = this.titleCaseSlug(pathParts[0] ?? input.artist ?? "");
    const conciseText = text.split(/Cifra Club[â€¢•]/i)[0].trim();
    const googleLabel = conciseText.match(/^(.*?)\s+-\s+(.*?)\s+-\s+Cifra Club$/i);
    if (googleLabel) {
      return { title: googleLabel[1].trim(), artist: googleLabel[2].trim() };
    }

    const currentParts = new URL(currentUrl).pathname.split("/").filter(Boolean);
    const isArtistCatalog = currentParts[0] === pathParts[0] && currentParts.includes("musicas.html");
    if (isArtistCatalog && conciseText && !/opções/i.test(conciseText)) {
      return { title: conciseText.trim(), artist: input.artist ?? fallbackArtist };
    }

    if (conciseText && conciseText.length <= 200 && !/opções/i.test(conciseText)) {
      return { title: conciseText.replace(/^\d{2}\s+/, "").trim(), artist: fallbackArtist };
    }

    return { title: fallbackTitle, artist: fallbackArtist };
  }

  private static matchesCandidate(candidate: Pick<CifraClubSearchResult, "title" | "artist">, input: CifraClubSearchInput): boolean {
    if (input.title && !this.fieldMatches(candidate.title, input.title)) return false;
    if (input.artist && !this.fieldMatches(candidate.artist, input.artist)) return false;
    return true;
  }

  private static compareCandidates(first: CifraClubSearchResult, second: CifraClubSearchResult, input: CifraClubSearchInput): number {
    const scoreDifference = this.scoreCandidate(second, input) - this.scoreCandidate(first, input);
    if (scoreDifference) return scoreDifference;
    return first.title.localeCompare(second.title, "pt-BR", { sensitivity: "base" })
      || first.artist.localeCompare(second.artist, "pt-BR", { sensitivity: "base" });
  }

  private static scoreCandidate(candidate: Pick<CifraClubSearchResult, "title" | "artist">, input: CifraClubSearchInput): number {
    return this.fieldScore(candidate.title, input.title, 2) + this.fieldScore(candidate.artist, input.artist, 1);
  }

  private static fieldScore(candidateValue: string, expectedValue: string | undefined, weight: number): number {
    if (!expectedValue) return 0;
    const candidate = this.normalize(candidateValue);
    const expected = this.normalize(expectedValue);
    if (!candidate || !expected) return 0;
    if (candidate === expected) return 20 * weight;
    if (candidate.startsWith(expected) || expected.startsWith(candidate)) return 12 * weight;
    if (candidate.includes(expected) || expected.includes(candidate)) return 8 * weight;
    return expected.split(" ").reduce(
      (score, part) => score + (part.length > 2 && candidate.includes(part) ? weight : 0),
      0
    );
  }

  private static fieldMatches(candidateValue: string, expectedValue: string): boolean {
    const candidate = this.normalize(candidateValue);
    const expected = this.normalize(expectedValue);
    if (!candidate || !expected) return false;
    if (candidate.includes(expected) || expected.includes(candidate)) return true;
    const expectedParts = expected.split(" ").filter((part) => part.length > 2);
    return expectedParts.length > 0 && expectedParts.every((part) => candidate.includes(part));
  }

  private static labelQuality(candidate: Pick<CifraClubSearchResult, "title" | "artist">): number {
    let quality = 0;
    if (candidate.title && !candidate.title.includes("-")) quality += 1;
    if (candidate.artist && !candidate.artist.includes("-")) quality += 1;
    if (/[^a-z0-9 ]/i.test(candidate.title)) quality += 1;
    if (/[^a-z0-9 ]/i.test(candidate.artist)) quality += 1;
    return quality;
  }

  private static normalize(value: string): string {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  private static findNearbyKey(html: string, index: number): string | null {
    const nearby = html.slice(index, index + 700);
    const match = nearby.match(/\b(?:Tom|tom)\s*:?\s*([A-G](?:#|b)?m?)/);
    return match?.[1] ?? null;
  }
}
