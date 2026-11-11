import { bulkImportBatches } from "@/lib/api/stock.functions";
import { ImportCsvDialog } from "@/components/import-csv-dialog";
import type { CsvTemplateColumn } from "@/lib/csv";

// One row per batch — this is the file a pharmacy has when moving from another system or taking
// an opening stock count. Shared by the Stock and Expiry tabs because both are views of the same
// batch records; importing from either lands in the same place.
const BATCH_IMPORT_COLUMNS: CsvTemplateColumn[] = [
  { key: "medicineName", label: "Medicine Name", required: true, example: "PARACETAMOL 500MG" },
  { key: "batchNo", label: "Batch Number", required: true, example: "PCM2456" },
  // The template shows the month-only form deliberately: it is what is printed on most strips,
  // and the importer accepts it alongside full dates.
  { key: "expiryDate", label: "Expiry Date", required: true, example: "11/2027" },
  { key: "quantity", label: "Quantity", example: "120" },
  { key: "mrp", label: "MRP", example: "35" },
  { key: "purchasePrice", label: "Purchase Price", example: "20" },
  { key: "supplierName", label: "Supplier Name", example: "Aarav Medico Distributors" },
  { key: "manufactureDate", label: "Manufacture Date", example: "12/2025" },
];

export function ImportBatchesDialog({ onImported }: { onImported?: () => void }) {
  return (
    <ImportCsvDialog
      entityName="Batch"
      columns={BATCH_IMPORT_COLUMNS}
      onImport={(rows) => bulkImportBatches({ data: { rows } })}
      onImported={onImported}
    />
  );
}
