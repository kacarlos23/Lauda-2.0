import { promises as fs } from "node:fs";
import { chromium, Download, Page } from "playwright";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { CifraClubSearchInput, MUSICAL_KEYS } from "../validators/song.schema";

const BASE_URL = "https://www.cifraclub.com.br";
const SEARCH_LIMIT = 8;
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
      const directItems = await this.searchDirectCandidates(page, input);
      if (directItems.length) return { items: directItems.slice(0, SEARCH_LIMIT) };

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });

      const query = `${input.artist} ${input.title}`;
      const searchInput = page.locator('input[type="search"], input[name="q"], input[placeholder*="tocar" i], input[placeholder*="Pesquisar" i]').first();
      if (await searchInput.count()) {
        await searchInput.fill(query);
        await Promise.all([
          page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined),
          page.keyboard.press("Enter"),
        ]);
      } else {
        await page.goto(`${BASE_URL}/busca/?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      }

      const html = await page.content();
      const items = CifraClubImportService.parseSearchResults(html, page.url(), input).slice(0, SEARCH_LIMIT);
      if (!items.length) throw new NotFoundError("Nenhuma cifra encontrada no Cifra Club para esta música.");
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
        if (CifraClubImportService.scoreCandidate(parsed, input) < 4) continue;
        results.set(parsed.cifraUrl, {
          title: parsed.title,
          artist: parsed.artist,
          url: parsed.cifraUrl,
          originalKey: parsed.originalKey,
        });
      } catch {
        // Candidatos diretos podem não existir; a busca HTML abaixo continua como fallback.
      }
    }

    const artistPageUrl = CifraClubImportService.artistPageUrl(input.artist);
    if (artistPageUrl) {
      try {
        const response = await page.goto(artistPageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
        if (response?.ok()) {
          const html = await page.content();
          for (const item of CifraClubImportService.parseSearchResults(html, page.url(), input)) {
            const previous = results.get(item.url);
            results.set(item.url, previous ? { ...previous, originalKey: previous.originalKey ?? item.originalKey ?? null } : item);
          }
        }
      } catch {
        // Se a página do artista não existir ou mudar, a busca HTML abaixo continua como fallback.
      }
    }

    return Array.from(results.values())
      .sort((a, b) => CifraClubImportService.scoreCandidate(b, input) - CifraClubImportService.scoreCandidate(a, input));
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
      const artist = this.titleCaseSlug(pathParts[0] ?? input.artist);
      const title = text && !/opções/i.test(text) ? text.replace(/^\d+\s*/, "").trim() : this.titleCaseSlug(pathParts[1] ?? input.title);

      const score = this.scoreCandidate({ title, artist }, input);
      if (!this.titleMatches(title, input.title)) continue;
      if (score < 4) continue;
      results.set(url, { title, artist, url, originalKey: this.findNearbyKey(html, match.index) });
    }

    return Array.from(results.values())
      .sort((a, b) => this.scoreCandidate(b, input) - this.scoreCandidate(a, input));
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
    const artistSlug = this.slugify(input.artist);
    const titleSlug = this.slugify(input.title);
    if (!artistSlug || !titleSlug) return [];
    return [`${BASE_URL}/${artistSlug}/${titleSlug}/`];
  }

  private static artistPageUrl(artist: string): string | null {
    const artistSlug = this.slugify(artist);
    return artistSlug ? `${BASE_URL}/${artistSlug}/` : null;
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

  private static scoreCandidate(candidate: Pick<CifraClubSearchResult, "title" | "artist">, input: CifraClubSearchInput): number {
    const title = this.normalize(candidate.title);
    const artist = this.normalize(candidate.artist);
    const expectedTitle = this.normalize(input.title);
    const expectedArtist = this.normalize(input.artist);
    let score = 0;
    if (title.includes(expectedTitle) || expectedTitle.includes(title)) score += 4;
    if (artist.includes(expectedArtist) || expectedArtist.includes(artist)) score += 4;
    expectedTitle.split(" ").forEach((part) => { if (part.length > 2 && title.includes(part)) score += 1; });
    expectedArtist.split(" ").forEach((part) => { if (part.length > 2 && artist.includes(part)) score += 1; });
    return score;
  }

  private static titleMatches(candidateTitle: string, expectedTitle: string): boolean {
    const title = this.normalize(candidateTitle);
    const expected = this.normalize(expectedTitle);
    if (!title || !expected) return false;
    if (title.includes(expected) || expected.includes(title)) return true;
    const expectedParts = expected.split(" ").filter((part) => part.length > 2);
    return expectedParts.length > 0 && expectedParts.every((part) => title.includes(part));
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
