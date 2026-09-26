import { Order, Sale } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

export interface SimpleNoteItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface SimpleNoteData {
  kindLabel: "Venda" | "Encomenda";
  referenceId: string;
  dateLabel: string;
  customerName: string;
  deliveryDateLabel?: string;
  deliveryAddress?: string;
  notes?: string;
  items: SimpleNoteItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
}

export function buildSaleNoteData(sale: Sale): SimpleNoteData {
  const subtotalCents = sale.subtotalCents ?? sale.items.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    kindLabel: "Venda",
    referenceId: sale.id,
    dateLabel: formatDateBR(sale.createdAt),
    customerName: sale.customerName,
    items: sale.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })),
    subtotalCents,
    discountCents: sale.discountCents ?? 0,
    totalCents: sale.totalCents,
    paidCents: sale.paidCents,
    pendingCents: sale.pendingCents,
  };
}

export function buildOrderNoteData(order: Order): SimpleNoteData {
  return {
    kindLabel: "Encomenda",
    referenceId: order.id,
    dateLabel: formatDateBR(order.orderDate),
    customerName: order.customerName,
    deliveryDateLabel: formatDateBR(order.expectedDate),
    deliveryAddress: order.deliveryAddress,
    notes: order.notes,
    items: order.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })),
    subtotalCents: order.totalCents,
    discountCents: 0,
    totalCents: order.totalCents,
    paidCents: order.paidCents,
    pendingCents: order.pendingCents,
  };
}

function wrapText(text: string, maxChars = 82): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function winAnsiBytes(value: string): number[] {
  const special: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a,
    0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
    0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c,
    0x17e: 0x9e, 0x178: 0x9f,
  };

  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0x3f;
    if (code === 0x0a || code === 0x0d) bytes.push(0x20);
    else if (code >= 0x00 && code <= 0xff) bytes.push(code);
    else bytes.push(special[code] ?? 0x3f);
  }
  return bytes;
}

function toHex(value: string): string {
  return winAnsiBytes(value).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
}

function buildPdfLines(data: SimpleNoteData): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "DELÍCIAS MANAGER", size: 18, bold: true },
    { text: "NOTA SIMPLES", size: 14, bold: true },
    { text: data.kindLabel, size: 10 },
    { text: "Nº: " + data.referenceId, size: 9 },
    { text: "Data: " + data.dateLabel, size: 9 },
    { text: "Cliente: " + data.customerName, size: 10 },
    { text: "", gap: 8 },
    { text: "ITENS", size: 11, bold: true },
  ];

  for (const item of data.items) {
    for (const line of wrapText(
      String(item.quantity) + " x " + item.name + " - " + formatCurrencyBRL(item.totalCents),
      78
    )) {
      lines.push({ text: line, size: 10 });
    }
    lines.push({ text: "Preço unitário: " + formatCurrencyBRL(item.unitPriceCents), size: 8 });
  }

  lines.push({ text: "", gap: 8 });
  lines.push({ text: "Subtotal: " + formatCurrencyBRL(data.subtotalCents), size: 10 });
  if (data.discountCents > 0) {
    lines.push({ text: "Desconto: - " + formatCurrencyBRL(data.discountCents), size: 10 });
  }
  lines.push({ text: "TOTAL: " + formatCurrencyBRL(data.totalCents), size: 12, bold: true });
  lines.push({ text: "Recebido: " + formatCurrencyBRL(data.paidCents), size: 10 });
  lines.push({ text: "Pendente: " + formatCurrencyBRL(data.pendingCents), size: 10 });

  if (data.deliveryDateLabel) lines.push({ text: "Entrega prevista: " + data.deliveryDateLabel, size: 9 });
  if (data.deliveryAddress?.trim()) {
    for (const line of wrapText("Endereço: " + data.deliveryAddress, 78)) lines.push({ text: line, size: 9 });
  }
  if (data.notes?.trim()) {
    for (const line of wrapText("Observações: " + data.notes, 78)) lines.push({ text: line, size: 9 });
  }

  lines.push({ text: "", gap: 10 });
  lines.push({ text: "Documento simples de conferência. Não é documento fiscal.", size: 8 });
  return lines;
}

function buildPages(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [[]];
  let currentPage = pages[0];
  let used = 0;
  const available = 755;

  for (const line of lines) {
    const size = line.size ?? 10;
    const step = line.gap ?? (size >= 16 ? 24 : size >= 12 ? 20 : 15);
    if (used + step > available && currentPage.length > 0) {
      currentPage = [];
      pages.push(currentPage);
      used = 0;
    }
    currentPage.push(line);
    used += step;
  }
  return pages;
}

function makeContentStream(lines: PdfLine[]): string {
  const content: string[] = ["BT"];
  let y = 790;

  for (const line of lines) {
    const size = line.size ?? 10;
    const gap = line.gap ?? (size >= 16 ? 24 : size >= 12 ? 20 : 15);
    if (!line.text) {
      y -= gap;
      continue;
    }
    const font = line.bold ? "F2" : "F1";
    content.push("/" + font + " " + size + " Tf 1 0 0 1 48 " + y + " Tm <" + toHex(line.text) + "> Tj");
    y -= gap;
  }

  content.push("ET");
  return content.join("\n");
}

export function generateSimpleNotePdf(data: SimpleNoteData): Blob {
  const pages = buildPages(buildPdfLines(data));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageObjectNumbers: number[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    const pageObjectNumber = 5 + i * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);
    const stream = makeContentStream(pages[i]);
    objects[pageObjectNumber] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " +
      contentObjectNumber + " 0 R >>";
    objects[contentObjectNumber] =
      "<< /Length " + new TextEncoder().encode(stream).length + " >>\nstream\n" +
      stream + "\nendstream";
  }

  objects[2] =
    "<< /Type /Pages /Count " + pages.length + " /Kids [" +
    pageObjectNumbers.map((n) => n + " 0 R").join(" ") + "] >>";

  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = encoder.encode(pdf).length;
    pdf += i + " 0 obj\n" + objects[i] + "\nendobj\n";
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += "xref\n0 " + objects.length + "\n";
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i += 1) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + objects.length + " /Root 1 0 R >>\nstartxref\n" +
    xrefOffset + "\n%%EOF";

  return new Blob([pdf], { type: "application/pdf" });
}

export function sanitizePdfFilename(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
