export type PrintBillItem = {
  medicineName: string;
  pack?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  quantity: number;
  rate: number;
  mrp: number;
};

export type BillCustomFieldItem = { label: string; value: string };

export type BillCustomization = {
  showDoctor: boolean;
  showCustomerAddress: boolean;
  showBatchNo: boolean;
  showExpiry: boolean;
  showMrp: boolean;
  showDiscountPercent: boolean;
  footerNote: string;
  termsText: string; // one condition per line
  customFields: BillCustomFieldItem[];
  // The saved print layout (Settings -> Bill Customization). Null for pharmacies that never saved
  // one; layoutFromSettings then derives it from the show* switches above.
  layout?: BillLayout | null;
};

export const DEFAULT_BILL_CUSTOMIZATION: BillCustomization = {
  showDoctor: true,
  showCustomerAddress: false,
  showBatchNo: true,
  showExpiry: true,
  showMrp: true,
  showDiscountPercent: true,
  footerNote: "",
  termsText: [
    "Goods once sold will not be taken back or exchanged.",
    "All disputes are subject to local jurisdiction only.",
    "Please retain this bill for any exchange or warranty claims.",
  ].join("\n"),
  customFields: [],
  layout: null,
};

export type BillColumnKey =
  | "sno"
  | "description"
  | "pack"
  | "batch"
  | "expiry"
  | "qty"
  | "rate"
  | "mrp"
  | "discount"
  | "amount";

export const BILL_COLUMNS: { key: BillColumnKey; label: string }[] = [
  { key: "sno", label: "S.No" },
  { key: "description", label: "Item Description" },
  { key: "pack", label: "Packing" },
  { key: "batch", label: "Batch No." },
  { key: "expiry", label: "Expiry" },
  { key: "qty", label: "Qty" },
  { key: "rate", label: "Rate" },
  { key: "mrp", label: "MRP" },
  { key: "discount", label: "Dis%" },
  { key: "amount", label: "Amount" },
];

export type BillSectionKey =
  | "firmHeader"
  | "licence"
  | "phone"
  | "copyLabel"
  | "patient"
  | "customerAddress"
  | "doctor"
  | "invoiceNo"
  | "date"
  | "footerNote"
  | "terms"
  | "customFields"
  | "signature"
  | "totalsBreakdown"
  | "duplicateCopy";

export const BILL_SECTIONS: { key: BillSectionKey; label: string }[] = [
  { key: "firmHeader", label: "Pharmacy name & address" },
  { key: "licence", label: "D.L. / GST number" },
  { key: "phone", label: "Phone" },
  { key: "copyLabel", label: "Original/Duplicate label" },
  { key: "patient", label: "Patient name" },
  { key: "customerAddress", label: "Patient address" },
  { key: "doctor", label: "Doctor / hospital" },
  { key: "invoiceNo", label: "Invoice number" },
  { key: "date", label: "Date" },
  { key: "footerNote", label: "Footer note" },
  { key: "terms", label: "Terms & conditions" },
  { key: "customFields", label: "Custom fields" },
  { key: "signature", label: "Signature block" },
  { key: "totalsBreakdown", label: "Sub total / adjustments / round off" },
  { key: "duplicateCopy", label: "Duplicate copy" },
];

// Which columns and sections a bill prints, and whether it prints plain (no table grid lines or
// boxes). Saved once in bill settings so every printout uses it; the bill editor can also apply a
// one-off variation to a single printout.
export type BillLayout = {
  plain: boolean;
  hiddenColumns: BillColumnKey[];
  hiddenSections: BillSectionKey[];
};

export function layoutFromSettings(settings: BillCustomization | null | undefined): BillLayout {
  const s = settings ?? DEFAULT_BILL_CUSTOMIZATION;
  if (s.layout) {
    return { plain: s.layout.plain, hiddenColumns: [...s.layout.hiddenColumns], hiddenSections: [...s.layout.hiddenSections] };
  }
  const hiddenColumns: BillColumnKey[] = [];
  if (!s.showBatchNo) hiddenColumns.push("batch");
  if (!s.showExpiry) hiddenColumns.push("expiry");
  if (!s.showMrp) hiddenColumns.push("mrp");
  if (!s.showDiscountPercent) hiddenColumns.push("discount");
  const hiddenSections: BillSectionKey[] = [];
  if (!s.showDoctor) hiddenSections.push("doctor");
  if (!s.showCustomerAddress) hiddenSections.push("customerAddress");
  return { plain: false, hiddenColumns, hiddenSections };
}

// Settings with `layout` applied, and the legacy show* switches updated to agree with it.
export function withLayout(settings: BillCustomization, layout: BillLayout): BillCustomization {
  return {
    ...settings,
    layout,
    showBatchNo: !layout.hiddenColumns.includes("batch"),
    showExpiry: !layout.hiddenColumns.includes("expiry"),
    showMrp: !layout.hiddenColumns.includes("mrp"),
    showDiscountPercent: !layout.hiddenColumns.includes("discount"),
    showDoctor: !layout.hiddenSections.includes("doctor"),
    showCustomerAddress: !layout.hiddenSections.includes("customerAddress"),
  };
}

export type PrintBillData = {
  billNumber: string;
  billType: string;
  createdAt: string;
  firmName?: string | null;
  dlNo?: string | null;
  gstNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  doctorName?: string | null;
  hospitalName?: string | null;
  items: PrintBillItem[];
  discount: number;
  settings?: BillCustomization | null;
  layout?: BillLayout | null;
};

function esc(value: string) {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function money(value: number) {
  return value.toFixed(2);
}

function formatExpiry(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

// Doctor takes precedence when both are given — a hospital name is only shown as a fallback for
// bills that were referred by an institution rather than a specific doctor.
function referrerLine(bill: PrintBillData): string {
  if (bill.doctorName) return `<strong>Prescribed by Dr:</strong> Dr. ${esc(bill.doctorName)}`;
  if (bill.hospitalName) return `<strong>Referred by:</strong> ${esc(bill.hospitalName)}`;
  return `<strong>Prescribed by Dr:</strong> —`;
}

type Col = {
  key: BillColumnKey;
  header: string;
  align: "left" | "center" | "right";
  cell: (item: PrintBillItem, i: number) => string;
};

const ALL_COLUMNS: Col[] = [
  { key: "sno", header: "S.No", align: "center", cell: (_item, i) => String(i + 1) },
  {
    key: "description",
    header: "Item Description",
    align: "left",
    cell: (item) => esc(item.medicineName),
  },
  { key: "pack", header: "Packing", align: "center", cell: (item) => esc(item.pack || "—") },
  { key: "batch", header: "Batch No.", align: "center", cell: (item) => esc(item.batchNo || "—") },
  { key: "expiry", header: "Exp.", align: "center", cell: (item) => formatExpiry(item.expiryDate) },
  { key: "qty", header: "Qty", align: "center", cell: (item) => String(item.quantity) },
  { key: "rate", header: "Rate", align: "right", cell: (item) => money(item.rate) },
  { key: "mrp", header: "MRP", align: "right", cell: (item) => money(item.mrp) },
  {
    key: "discount",
    header: "Dis%",
    align: "right",
    cell: (item) => {
      const disPercent = item.mrp > 0 ? ((item.mrp - item.rate) / item.mrp) * 100 : 0;
      return disPercent.toFixed(2);
    },
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (item) => money(item.rate * item.quantity),
  },
];

function renderCopy(bill: PrintBillData, label: "Original Copy" | "Duplicate Copy") {
  const settings = bill.settings ?? DEFAULT_BILL_CUSTOMIZATION;
  const layout = bill.layout ?? layoutFromSettings(settings);
  const show = (section: BillSectionKey) => !layout.hiddenSections.includes(section);
  const subtotal = bill.items.reduce((sum, i) => sum + i.rate * i.quantity, 0);
  const beforeRounding = subtotal - bill.discount;
  const grandTotal = Math.round(beforeRounding);
  const roundOff = grandTotal - beforeRounding;

  const columns = ALL_COLUMNS.filter((c) => !layout.hiddenColumns.includes(c.key));
  const headerRow = columns.map((c) => `<th>${c.header}</th>`).join("");
  const rows = bill.items
    .map((item, i) => {
      const cells = columns.map((c) => `<td class="${c.align === "left" ? "" : c.align}">${c.cell(item, i)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const customerLine = show("patient")
    ? `<strong>Patient Name:</strong> ${esc(bill.customerName || "Walk-in Customer")}${
        show("customerAddress") && bill.customerAddress
          ? `<br/><span class="muted">${esc(bill.customerAddress)}</span>`
          : ""
      }`
    : "";

  const termsLines = settings.termsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const customFieldsHtml = (show("customFields") ? settings.customFields : [])
    .filter((f) => f.label.trim())
    .map((f) => `<p class="custom-field"><strong>${esc(f.label)}:</strong> ${esc(f.value)}</p>`)
    .join("");

  return `
  <section class="copy">
    <div class="header-row">
      <div class="header-left">
        ${show("licence") && bill.dlNo ? `D.L. No: ${esc(bill.dlNo)}<br/>` : ""}
        ${show("licence") && bill.gstNumber ? `GST No: ${esc(bill.gstNumber)}` : ""}
      </div>
      <div class="header-center">
        ${show("firmHeader") ? `<h1>${esc(bill.firmName || "Your Pharmacy Name")}</h1>` : ""}
        ${show("firmHeader") && bill.address ? `<p class="muted">${esc(bill.address)}</p>` : ""}
      </div>
      <div class="header-right">
        ${show("copyLabel") ? `<div class="copy-label">${label}</div>` : ""}
        Sale Bill<br/>
        ${show("phone") && bill.phone ? `Phone: ${esc(bill.phone)}` : ""}
      </div>
    </div>
    <hr/>
    <table class="meta-table">
      <tr>
        <td>${customerLine}</td>
        <td>${show("invoiceNo") ? `<strong>Invoice No:</strong> ${esc(bill.billNumber)}` : ""}</td>
      </tr>
      <tr>
        <td>${show("doctor") ? referrerLine(bill) : ""}</td>
        <td>${show("date") ? `<strong>Date:</strong> ${esc(bill.createdAt)}` : ""}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="bottom-row">
      <div class="terms">
        ${show("footerNote") && settings.footerNote ? `<p class="footer-note">${esc(settings.footerNote)}</p>` : ""}
        ${
          show("terms") && termsLines.length
            ? `<p class="terms-title">Terms &amp; Conditions</p><ol>${termsLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`
            : ""
        }
        ${customFieldsHtml}
        ${
          show("signature")
            ? `<p class="signature-line">for ${esc(bill.firmName || "Your Pharmacy Name")}</p>
        <p class="signature-space">&nbsp;</p>
        <p class="muted">Authorised Signatory</p>`
            : ""
        }
      </div>
      <table class="totals-table">
        ${
          show("totalsBreakdown")
            ? `<tr><td>Sub Total</td><td class="right">${money(subtotal)}</td></tr>
        <tr><td>CR/DR Note</td><td class="right">0.00</td></tr>
        <tr><td>Other Adj.</td><td class="right">${money(bill.discount)}</td></tr>
        <tr><td>Round Off</td><td class="right">${money(roundOff)}</td></tr>`
            : ""
        }
        <tr class="grand"><td>GRAND TOTAL</td><td class="right">${money(grandTotal)}</td></tr>
      </table>
    </div>
  </section>`;
}

export function printBill(bill: PrintBillData) {
  const layout = bill.layout ?? layoutFromSettings(bill.settings);
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Bill ${esc(bill.billNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 12px; font-size: 11px; }
  .copy { max-width: 780px; margin: 0 auto; border: 1px solid #111; padding: 10px; position: relative; page-break-inside: avoid; break-inside: avoid-page; }
  .copy + .copy { margin-top: 10px; }
  .cut-line { display: flex; align-items: center; gap: 8px; max-width: 780px; margin: 6px auto; color: #888; font-size: 9px; }
  .cut-line::before, .cut-line::after { content: ""; flex: 1; border-top: 1px dashed #999; }
  .copy-label { font-size: 11px; font-style: italic; color: #444; margin-bottom: 2px; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .header-left, .header-right { font-size: 11px; white-space: nowrap; }
  .header-center { flex: 1; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .muted { color: #555; font-size: 11px; margin: 0; }
  hr { border: none; border-top: 1px solid #111; margin: 10px 0; }
  .meta-table { width: 100%; font-size: 12px; margin-bottom: 10px; border-collapse: collapse; }
  .meta-table td { padding: 2px 4px; }
  table.items-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .items-table th, .items-table td { border: 1px solid #111; padding: 4px 5px; }
  .items-table th { background: #eee; text-align: left; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bottom-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; align-items: flex-end; }
  .terms { flex: 1; font-size: 10px; }
  .footer-note { font-size: 11px; font-weight: bold; margin: 0 0 6px; }
  .custom-field { margin: 2px 0; font-size: 10px; }
  .terms-title { font-weight: bold; text-decoration: underline; margin: 0 0 4px; font-size: 11px; }
  .terms ol { margin: 0; padding-left: 16px; }
  .signature-line { margin-top: 18px; font-size: 11px; font-weight: bold; }
  .signature-space { height: 30px; margin: 0; }
  .totals-table { width: 260px; border-collapse: collapse; font-size: 12px; }
  .totals-table td { padding: 3px 4px; }
  .totals-table tr.grand td { font-weight: bold; font-size: 14px; border-top: 1px solid #111; padding-top: 6px; }
  /* Plain layout: just the data — no outer box, no grid lines or shaded header, only a rule
     under the column headings so the columns still read as columns. */
  body.plain .copy { border: none; padding: 4px 0; }
  body.plain .items-table th, body.plain .items-table td { border: none; padding: 3px 5px; }
  body.plain .items-table th { background: none; border-bottom: 1px solid #111; }
  body.plain .totals-table tr.grand td { border-top: none; }
  @media print { @page { margin: 10mm; size: A4; } }
</style>
</head>
<body class="${layout.plain ? "plain" : ""}">
  ${renderCopy(bill, "Original Copy")}
  ${
    layout.hiddenSections.includes("duplicateCopy")
      ? ""
      : `<div class="cut-line">&#9986; cut here</div>
  ${renderCopy(bill, "Duplicate Copy")}`
  }
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) {
    throw new Error("Popup blocked — allow popups for this site to print bills.");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
