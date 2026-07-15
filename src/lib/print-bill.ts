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
};

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
  items: PrintBillItem[];
  discount: number;
  settings?: BillCustomization | null;
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

type Col = { header: string; align: "left" | "center" | "right"; cell: (item: PrintBillItem, i: number) => string };

function buildColumns(settings: BillCustomization): Col[] {
  const cols: Col[] = [
    { header: "S.No", align: "center", cell: (_item, i) => String(i + 1) },
    { header: "Item Description", align: "left", cell: (item) => esc(item.medicineName) },
    { header: "Packing", align: "center", cell: (item) => esc(item.pack || "—") },
  ];
  if (settings.showBatchNo) {
    cols.push({ header: "Batch No.", align: "center", cell: (item) => esc(item.batchNo || "—") });
  }
  if (settings.showExpiry) {
    cols.push({ header: "Exp.", align: "center", cell: (item) => formatExpiry(item.expiryDate) });
  }
  cols.push({ header: "Qty", align: "center", cell: (item) => String(item.quantity) });
  cols.push({ header: "Rate", align: "right", cell: (item) => money(item.rate) });
  if (settings.showMrp) {
    cols.push({ header: "MRP", align: "right", cell: (item) => money(item.mrp) });
  }
  if (settings.showDiscountPercent) {
    cols.push({
      header: "Dis%",
      align: "right",
      cell: (item) => {
        const disPercent = item.mrp > 0 ? ((item.mrp - item.rate) / item.mrp) * 100 : 0;
        return disPercent.toFixed(2);
      },
    });
  }
  cols.push({ header: "Amount", align: "right", cell: (item) => money(item.rate * item.quantity) });
  return cols;
}

function renderCopy(bill: PrintBillData, label: "Original Copy" | "Duplicate Copy") {
  const settings = bill.settings ?? DEFAULT_BILL_CUSTOMIZATION;
  const subtotal = bill.items.reduce((sum, i) => sum + i.rate * i.quantity, 0);
  const beforeRounding = subtotal - bill.discount;
  const grandTotal = Math.round(beforeRounding);
  const roundOff = grandTotal - beforeRounding;

  const columns = buildColumns(settings);
  const headerRow = columns.map((c) => `<th>${c.header}</th>`).join("");
  const rows = bill.items
    .map((item, i) => {
      const cells = columns.map((c) => `<td class="${c.align === "left" ? "" : c.align}">${c.cell(item, i)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const customerLine = `<strong>Patient Name:</strong> ${esc(bill.customerName || "Walk-in Customer")}${
    settings.showCustomerAddress && bill.customerAddress ? `<br/><span class="muted">${esc(bill.customerAddress)}</span>` : ""
  }`;

  const termsLines = settings.termsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const customFieldsHtml = settings.customFields
    .filter((f) => f.label.trim())
    .map((f) => `<p class="custom-field"><strong>${esc(f.label)}:</strong> ${esc(f.value)}</p>`)
    .join("");

  return `
  <section class="copy">
    <div class="header-row">
      <div class="header-left">
        ${bill.dlNo ? `D.L. No: ${esc(bill.dlNo)}<br/>` : ""}
        ${bill.gstNumber ? `GST No: ${esc(bill.gstNumber)}` : ""}
      </div>
      <div class="header-center">
        <h1>${esc(bill.firmName || "Your Pharmacy Name")}</h1>
        ${bill.address ? `<p class="muted">${esc(bill.address)}</p>` : ""}
      </div>
      <div class="header-right">
        <div class="copy-label">${label}</div>
        Sale Bill<br/>
        ${bill.phone ? `Phone: ${esc(bill.phone)}` : ""}
      </div>
    </div>
    <hr/>
    <table class="meta-table">
      <tr>
        <td>${customerLine}</td>
        <td><strong>Invoice No:</strong> ${esc(bill.billNumber)}</td>
      </tr>
      <tr>
        <td>${settings.showDoctor ? `<strong>Prescribed by Dr:</strong> ${bill.doctorName ? `Dr. ${esc(bill.doctorName)}` : "—"}` : ""}</td>
        <td><strong>Date:</strong> ${esc(bill.createdAt)}</td>
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
        ${settings.footerNote ? `<p class="footer-note">${esc(settings.footerNote)}</p>` : ""}
        ${
          termsLines.length
            ? `<p class="terms-title">Terms &amp; Conditions</p><ol>${termsLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`
            : ""
        }
        ${customFieldsHtml}
        <p class="signature-line">for ${esc(bill.firmName || "Your Pharmacy Name")}</p>
        <p class="signature-space">&nbsp;</p>
        <p class="muted">Authorised Signatory</p>
      </div>
      <table class="totals-table">
        <tr><td>Sub Total</td><td class="right">${money(subtotal)}</td></tr>
        <tr><td>CR/DR Note</td><td class="right">0.00</td></tr>
        <tr><td>Other Adj.</td><td class="right">${money(bill.discount)}</td></tr>
        <tr><td>Round Off</td><td class="right">${money(roundOff)}</td></tr>
        <tr class="grand"><td>GRAND TOTAL</td><td class="right">${money(grandTotal)}</td></tr>
      </table>
    </div>
  </section>`;
}

export function printBill(bill: PrintBillData) {
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
  @media print { @page { margin: 10mm; size: A4; } }
</style>
</head>
<body>
  ${renderCopy(bill, "Original Copy")}
  <div class="cut-line">&#9986; cut here</div>
  ${renderCopy(bill, "Duplicate Copy")}
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
