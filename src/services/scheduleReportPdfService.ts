import path from "path";
import PDFDocument from "pdfkit";

type ReportSchedule = {
  id: string;
  title: string;
  date: Date;
  ministry?: { id: string; name: string } | null;
  assignments?: Array<{
    id: string;
    role: string;
    status: string;
    user?: { id: string; name: string; email?: string | null } | null;
  }>;
  songs?: Array<{
    id: string;
    order: number;
    song?: {
      id: string;
      title: string;
      originalKey: string;
      bpm?: number | null;
      artist?: { id: string; name: string } | null;
    } | null;
  }>;
};

const fontRoot = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const regularFont = path.join(fontRoot, "DejaVuSans.ttf");
const boldFont = path.join(fontRoot, "DejaVuSans-Bold.ttf");

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function assignmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    ACCEPTED: "Confirmado",
    DECLINED: "Recusado",
  };
  return labels[status] ?? status;
}

function writeSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.9);
  doc.font("Bold").fontSize(14).fillColor("#10201A").text(title);
  doc.moveDown(0.35);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 48, doc.y).strokeColor("#DDE4DA").stroke();
  doc.moveDown(0.55);
}

function ensureSpace(doc: PDFKit.PDFDocument, height = 72) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

export class ScheduleReportPdfService {
  generate(schedule: ReportSchedule): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margins: { top: 54, right: 48, bottom: 54, left: 48 }, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.registerFont("Body", regularFont);
      doc.registerFont("Bold", boldFont);

      const scheduleDate = new Date(schedule.date);
      doc.font("Bold").fontSize(22).fillColor("#10201A").text("Relatório de Escala", { align: "center" });
      doc.moveDown(0.35);
      doc.font("Bold").fontSize(17).fillColor("#157A6E").text(schedule.title, { align: "center" });
      doc.moveDown(0.7);

      doc.roundedRect(48, doc.y, doc.page.width - 96, 86, 16).fillAndStroke("#EEF5F1", "#DDE4DA");
      doc.moveDown(0.8);
      doc.font("Body").fontSize(11).fillColor("#33423B");
      doc.text(`Ministério: ${schedule.ministry?.name ?? "Não informado"}`, 66, doc.y);
      doc.text(`Data: ${dateFormatter.format(scheduleDate)}`);
      doc.text(`Horário: ${timeFormatter.format(scheduleDate)}`);
      doc.moveDown(1.2);

      writeSectionTitle(doc, "Músicas da escala");
      const songs = [...(schedule.songs ?? [])].sort((a, b) => a.order - b.order);
      if (!songs.length) {
        doc.font("Body").fontSize(11).fillColor("#748179").text("Nenhuma música adicionada.");
      } else {
        songs.forEach((entry, index) => {
          ensureSpace(doc, 58);
          const song = entry.song;
          doc.roundedRect(doc.x, doc.y, doc.page.width - 96, 48, 12).fillAndStroke("#FFFFFF", "#DDE4DA");
          const y = doc.y + 9;
          doc.font("Bold").fontSize(12).fillColor("#10201A").text(`${index + 1}. ${song?.title ?? "Música sem título"}`, 64, y, { width: doc.page.width - 128 });
          doc.font("Body").fontSize(9.5).fillColor("#157A6E").text(
            `${song?.artist?.name ?? "Artista não informado"} · Tom ${song?.originalKey ?? "-"}${song?.bpm ? ` · ${song.bpm} BPM` : ""}`,
            64,
            y + 18,
            { width: doc.page.width - 128 }
          );
          doc.y += 58;
        });
      }

      writeSectionTitle(doc, "Membros escalados");
      const assignments = schedule.assignments ?? [];
      if (!assignments.length) {
        doc.font("Body").fontSize(11).fillColor("#748179").text("Nenhum membro escalado.");
      } else {
        assignments.forEach((assignment) => {
          ensureSpace(doc, 48);
          doc.font("Bold").fontSize(11).fillColor("#10201A").text(assignment.user?.name ?? "Membro sem nome", { continued: true });
          doc.font("Body").fontSize(10).fillColor("#33423B").text(`  —  ${assignment.role}`);
          doc.font("Body").fontSize(9).fillColor("#748179").text(`Status: ${assignmentStatusLabel(assignment.status)}`);
          doc.moveDown(0.45);
        });
      }

      const range = doc.bufferedPageRange();
      for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
        doc.switchToPage(pageIndex);
        doc.font("Body").fontSize(8).fillColor("#748179").text(
          `Lauda · ${pageIndex + 1} / ${range.count}`,
          48,
          doc.page.height - doc.page.margins.bottom - 10,
          { width: doc.page.width - 96, align: "center", lineBreak: false }
        );
      }

      doc.end();
    });
  }
}
