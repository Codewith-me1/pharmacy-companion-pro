// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Minimum amount of real (alphanumeric) text required before we trust a PDF's embedded text
// layer over falling back to image+OCR — a scanned invoice saved as PDF has no text layer at
// all, so pdf.js returns little or nothing for it; a digitally-generated invoice returns its
// full content.
const MIN_MEANINGFUL_CHARS = 100;

export interface PdfTextResult {
  text: string;
  hasMeaningfulText: boolean;
}

// Extracts a PDF's own embedded text (all pages), reconstructing a rough row/column layout from
// each text item's on-page position — pdf.js gives flat, unordered text runs with x/y
// coordinates, not reading order, so without this a table's cells would come out scrambled.
// Used ahead of image conversion: a digitally-generated invoice's real text is exact (no OCR
// uncertainty at all), so reading it directly beats rasterizing to a photo and OCR'ing that.
export async function extractPdfText(source: Blob): Promise<PdfTextResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const arrayBuffer = await source.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    // Group text runs into rows by their y-position (rounded to absorb sub-pixel/font-baseline
    // jitter within the same printed line), then sort each row left-to-right by x-position.
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as Array<{ str?: string; transform: number[] }>) {
      const str = item.str?.trim();
      if (!str) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], str });
      rows.set(y, row);
    }

    // PDF y-coordinates increase upward, so sort descending to read top-to-bottom.
    const orderedRows = Array.from(rows.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.str).join(" | "));

    pageTexts.push(orderedRows.join("\n"));
  }

  const text = pageTexts.join("\n\n");
  const meaningfulChars = text.replace(/[^a-zA-Z0-9]/g, "").length;
  return { text, hasMeaningfulText: meaningfulChars >= MIN_MEANINGFUL_CHARS };
}
