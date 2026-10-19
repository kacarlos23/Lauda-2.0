import path from "path";
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { ValidationError } from "../errors/AppError";
import { youtubeUrl } from "../validators/worshipOrder.schema";
import { loadPdfArtistImages } from "./pdfArtistImage";

type Participation = {
  order: number; moment: string; momentDescription?: string | null; videoUrlOverride?: string | null;
  song: { title: string; videoUrl?: string | null; artist?: { name: string; imageUrl?: string | null } | null };
};
export type WorshipPdfData = {
  date: string; churchName?: string | null;
  morning?: { songs: Participation[] } | null;
  evening?: { songs: Participation[] } | null;
};
const fontRoot = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const logoRelative = "mobile/assets/brand/png/lauda-symbol-512.png";
const text = (value: string) => value.replace(/[\x00-\x1f\x7f]/g, " ");
const green = "#1F6F55";

export class WorshipOrderPdfService {
  async generate(data: WorshipPdfData): Promise<Buffer> {
    const entries = [...(data.morning?.songs ?? []), ...(data.evening?.songs ?? [])];
    const images = await loadPdfArtistImages(entries.flatMap((entry) => entry.song.artist?.imageUrl ? [entry.song.artist.imageUrl] : []));
    const logo = [path.resolve(__dirname, "../../", logoRelative), path.resolve(process.cwd(), logoRelative), path.resolve(process.cwd(), "../", logoRelative)].find(existsSync);
    if (!logo) throw new ValidationError("A logo do Lauda não está disponível para gerar o PDF.");
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 46, bufferPages: true, info: { Title: "Ordem de Culto", Author: "Lauda" } });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      try {
        doc.registerFont("Body", path.join(fontRoot, "DejaVuSans.ttf"));
        doc.registerFont("Bold", path.join(fontRoot, "DejaVuSans-Bold.ttf"));
        const x = 46, width = doc.page.width - 92, bottom = doc.page.height - 64;
        const background = () => {
          doc.save().opacity(0.055).image(logo, (doc.page.width - 320) / 2, (doc.page.height - 320) / 2, { width: 320 }).restore();
        };
        background(); doc.on("pageAdded", background);
        let y = 46;
        const rawDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.date}T12:00:00Z`));
        const date = rawDate.charAt(0).toLocaleUpperCase("pt-BR") + rawDate.slice(1);
        doc.roundedRect(x, y, width, 76, 3).fill("#195C47");
        doc.font("Bold").fontSize(23).fillColor("#FFFFFF").text("ORDEM DE CULTO", x, y + 8, { width, align: "center" });
        doc.font("Body").fontSize(10).fillColor("#FFFFFF").text(date, x, y + 50, { width, align: "center" });
        y += 96;

        for (const [label, period] of [["CULTO DA MANHÃ", data.morning], ["CULTO DA NOITE", data.evening]] as const) {
          if (!period?.songs.length) continue;
          const songs = [...period.songs].sort((a, b) => a.order - b.order);
          const section = (continued = false) => {
            doc.font("Bold").fontSize(12).fillColor(green).text(label + (continued ? " · continuação" : ""), x, y, { width });
            doc.font("Body").fontSize(9).fillColor("#65746D").text(`${songs.length} ${songs.length === 1 ? "música" : "músicas"}`, x, y + 18, { width });
            y += 34;
          };
          const textX = x + 64, textWidth = width - 118;
          const measure = (entry: Participation) => {
            const title = text(entry.song.title), artist = text(entry.song.artist?.name ?? "");
            const moment = text(entry.moment === "Outro" && entry.momentDescription ? `Outro: ${entry.momentDescription}` : entry.moment);
            const titleHeight = doc.font("Bold").fontSize(12).heightOfString(title, { width: textWidth });
            const artistHeight = artist ? doc.font("Body").fontSize(9).heightOfString(artist, { width: textWidth }) + 4 : 0;
            const momentHeight = doc.font("Body").fontSize(9).heightOfString(moment, { width: textWidth - 12 });
            const badgeWidth = Math.min(textWidth, doc.widthOfString(moment) + 12);
            return { title, artist, moment, titleHeight, artistHeight, momentHeight, badgeWidth, height: Math.max(72, 28 + titleHeight + artistHeight + momentHeight) };
          };
          if (y + 34 + measure(songs[0]!).height > bottom) { doc.addPage(); y = 46; }
          section();
          songs.forEach((entry, index) => {
            const row = measure(entry);
            if (row.height > bottom - 80) throw new ValidationError("O título ou artista de uma música é extenso demais para uma página A4. Revise o cadastro.");
            if (y + row.height > bottom) { doc.addPage(); y = 46; section(true); }
            const avatarY = y + (row.height - 46) / 2;
            const image = entry.song.artist?.imageUrl ? images.get(entry.song.artist.imageUrl) : undefined;
            let drawn = false;
            if (image) {
              // Validate the decoder before applying the clipping path; a broken photo cannot break the report.
              try {
                const decoded = (doc as PDFKit.PDFDocument & { openImage(source: Buffer): { width: number; height: number } }).openImage(image);
                if (decoded.width * decoded.height <= 20_000_000) {
                  doc.save();
                  doc.roundedRect(x, avatarY, 46, 46, 8).clip();
                  try { doc.image(image, x, avatarY, { cover: [46, 46], align: "center", valign: "center" }); drawn = true; } finally { doc.restore(); }
                }
              } catch { /* Keep the neutral placeholder when an artist photo is unavailable. */ }
            }
            if (!drawn) {
              doc.roundedRect(x, avatarY, 46, 46, 8).fill("#E9F1EC");
              const initials = row.artist.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]).join("").toLocaleUpperCase("pt-BR");
              if (initials) doc.font("Bold").fontSize(13).fillColor(green).text(initials, x, avatarY + 14, { width: 46, align: "center", lineBreak: false });
            }
            const url = youtubeUrl(entry.song.videoUrl);
            doc.font("Bold").fontSize(12).fillColor(url ? green : "#172C25").text(row.title, textX, y + 10, { width: textWidth, ...(url ? { link: url } : {}) });
            if (row.artist) doc.font("Body").fontSize(9).fillColor("#65746D").text(row.artist, textX, y + 14 + row.titleHeight, { width: textWidth });
            const metaY = y + 18 + row.titleHeight + row.artistHeight;
            doc.roundedRect(textX - 3, metaY - 2, row.badgeWidth, row.momentHeight + 4, 4).fill("#E9F1EC");
            doc.font("Body").fontSize(9).fillColor(green).text(row.moment, textX + 2, metaY, { width: textWidth - 12 });
            if (url) {
              const cx = x + width - 18, cy = y + row.height / 2;
              doc.circle(cx, cy, 15).fill("#E9F1EC");
              doc.moveTo(cx - 4, cy - 6).lineTo(cx + 6, cy).lineTo(cx - 4, cy + 6).closePath().fill(green);
              doc.link(cx - 17, cy - 17, 34, 34, url);
            }
            if (index < songs.length - 1) doc.save().strokeOpacity(0.22).lineWidth(0.5).moveTo(x, y + row.height).lineTo(x + width, y + row.height).strokeColor(green).stroke().restore();
            y += row.height;
          });
          y += 18;
        }
        const pages = doc.bufferedPageRange();
        for (let page = 0; page < pages.count; page++) {
          doc.switchToPage(page);
          const marginBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.font("Body").fontSize(8).fillColor("#65746D").text(`Gerado pelo Lauda${pages.count > 1 ? ` · ${page + 1} / ${pages.count}` : ""}`, x, doc.page.height - 44, { width, align: "center", lineBreak: false });
          doc.page.margins.bottom = marginBottom;
        }
        doc.end();
      } catch (error) { doc.destroy(); reject(error); }
    });
  }
}
