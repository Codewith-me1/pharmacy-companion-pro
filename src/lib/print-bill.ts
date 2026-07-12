export type PrintBillItem = {
  medicineName: string;
  pack?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  quantity: number;
  rate: number;
  mrp: number;
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
  doctorName?: string | null;
  items: PrintBillItem[];
  discount: number;
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

function renderCopy(bill: PrintBillData, label: "Original Copy" | "Duplicate Copy") {
  const subtotal = bill.items.reduce((sum, i) => sum + i.rate * i.quantity, 0);
  const beforeRounding = subtotal - bill.discount;
  const grandTotal = Math.round(beforeRounding);
  const roundOff = grandTotal - beforeRounding;

  const rows = bill.items
    .map((item, i) => {
      const amount = item.rate * item.quantity;
      const disPercent = item.mrp > 0 ? ((item.mrp - item.rate) / item.mrp) * 100 : 0;
      return `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${esc(item.medicineName)}</td>
        <td class="center">${esc(item.pack || "—")}</td>
        <td class="center">${esc(item.batchNo || "—")}</td>
        <td class="center">${formatExpiry(item.expiryDate)}</td>
        <td class="center">${item.quantity}</td>
        <td class="right">${money(item.rate)}</td>
        <td class="right">${money(item.mrp)}</td>
        <td class="right">${disPercent.toFixed(2)}</td>
        <td class="right">${money(amount)}</td>
      </tr>`;
    })
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
        <td><strong>Patient Name:</strong> ${esc(bill.customerName || "Walk-in Customer")}</td>
        <td><strong>Invoice No:</strong> ${esc(bill.billNumber)}</td>
      </tr>
      <tr>
        <td><strong>Prescribed by Dr:</strong> ${bill.doctorName ? `Dr. ${esc(bill.doctorName)}` : "—"}</td>
        <td><strong>Date:</strong> ${esc(bill.createdAt)}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th>S.No</th>
          <th>Item Description</th>
          <th>Packing</th>
          <th>Batch No.</th>
          <th>Exp.</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>MRP</th>
          <th>Dis%</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="bottom-row">
      <div class="terms">
        <p class="terms-title">Terms &amp; Conditions</p>
        <ol>
          <li>Goods once sold will not be taken back or exchanged.</li>
          <li>All disputes are subject to local jurisdiction only.</li>
          <li>Please retain this bill for any exchange or warranty claims.</li>
        </ol>
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
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 12px; }
  .copy { max-width: 780px; margin: 0 auto 20px; border: 1px solid #111; padding: 16px; position: relative; }
  .copy + .copy { page-break-before: always; }
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
