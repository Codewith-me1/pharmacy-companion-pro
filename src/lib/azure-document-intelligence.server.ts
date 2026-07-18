import { AzureKeyCredential, DocumentAnalysisClient } from "@azure/ai-form-recognizer";
import type { DocumentTable } from "@azure/ai-form-recognizer";

// Server-only: talks to Azure Document Intelligence's prebuilt-layout model, which is a
// specialist OCR+table-structure engine — far more reliable at pinning invoice text to the
// correct row/column than asking a vision LLM to read the photo pixel-by-pixel. Its output (text
// + explicit table grids) is handed to the LLM as plain text so the LLM's job becomes pure
// semantic mapping (which column is "Rate" vs "MRP", which row is which medicine) instead of
// also having to do OCR — splitting "read the pixels" from "understand the invoice" is what
// buys the accuracy improvement here.
export interface InvoiceLayoutExtraction {
  /** Full document text in reading order, plus a separately rendered grid for every detected table. */
  text: string;
  tableCount: number;
}

export async function analyzeInvoiceLayout(
  endpoint: string,
  apiKey: string,
  imageBuffer: Buffer,
): Promise<InvoiceLayoutExtraction> {
  const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));
  const poller = await client.beginAnalyzeDocument("prebuilt-layout", imageBuffer);
  const result = await poller.pollUntilDone();

  const tables = result.tables ?? [];
  const tableBlocks = tables.map((table, index) => renderTableAsGrid(table, index));

  const text = [
    "=== FULL DOCUMENT TEXT (OCR output, reading order) ===",
    result.content?.trim() || "(no text detected)",
    "",
    "=== DETECTED TABLE STRUCTURE ===",
    "Use these grids to know exactly which value belongs to which row and column — they are the",
    "authoritative row/column layout for the goods table(s). The free text above may repeat the",
    "same values without structure; prefer the grid below when the two seem to disagree.",
    "",
    tableBlocks.length > 0 ? tableBlocks.join("\n\n") : "(No tables detected on this page.)",
  ].join("\n");

  return { text, tableCount: tables.length };
}

function renderTableAsGrid(table: DocumentTable, index: number): string {
  const grid: string[][] = Array.from({ length: table.rowCount }, () => Array(table.columnCount).fill(""));

  for (const cell of table.cells) {
    const value = cell.content.replace(/\s+/g, " ").trim();
    if (cell.rowIndex < table.rowCount && cell.columnIndex < table.columnCount) {
      grid[cell.rowIndex][cell.columnIndex] = cell.kind === "columnHeader" ? `[${value}]` : value;
    }
  }

  const rows = grid.map((row, rowIndex) => `Row ${rowIndex}: | ${row.join(" | ")} |`);
  return [`Table ${index + 1} (${table.rowCount} rows x ${table.columnCount} columns):`, ...rows].join("\n");
}
