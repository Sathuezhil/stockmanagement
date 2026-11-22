import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { auth } from "@/auth";
import { isReportType } from "@/lib/constants";
import { buildReport } from "@/server/services/reports";
import { getSettingsDto } from "@/server/guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseDate(value: string | null, end = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.permissions.includes("reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  if (!isReportType(type)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });

  const report = await buildReport(
    type,
    {
      q: url.searchParams.get("q") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      from: parseDate(url.searchParams.get("from")),
      to: parseDate(url.searchParams.get("to"), true),
    },
    false,
  );
  const settings = await getSettingsDto();
  const filename = `${type}-report`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(report.title);
    sheet.addRow([settings.companyName]);
    sheet.addRow([report.title]);
    sheet.addRow([]);
    sheet.addRow(report.columns);
    report.rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(4).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const pdf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fontSize(16).text(settings.companyName);
    doc.moveDown(0.2);
    doc.fontSize(12).text(report.title);
    doc.fontSize(8).fillColor("#555555").text(`Generated ${new Date().toLocaleString()}`);
    doc.moveDown(0.6);
    doc.fillColor("#111111").fontSize(8);
    const width = doc.page.width - 72;
    const colWidth = width / Math.max(report.columns.length, 1);
    const drawRow = (values: (string | number)[], bold = false) => {
      const y = doc.y;
      if (bold) doc.font("Helvetica-Bold");
      else doc.font("Helvetica");
      values.forEach((value, index) => {
        doc.text(String(value), 36 + index * colWidth, y, { width: colWidth - 4, height: 18, ellipsis: true });
      });
      doc.moveDown(0.4);
      if (doc.y > doc.page.height - 48) doc.addPage();
    };
    drawRow(report.columns, true);
    report.rows.forEach((row) => drawRow(row));
    doc.end();
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
