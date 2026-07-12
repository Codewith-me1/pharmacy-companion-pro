export type SupplierReturnItem = {
  medicineName: string;
  pack?: string | null;
  quantity: number;
  batchNo: string;
  expiryDate: string;
  mrp: number;
};

export type SupplierReturnReportData = {
  firmName?: string | null;
  dlNo?: string | null;
  mobile?: string | null;
  supplierName: string;
  items: SupplierReturnItem[];
};

function esc(value: string) {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

export function printSupplierReturnReport(data: SupplierReturnReportData) {
  const rows = data.items
    .map((item) => {
      const amount = item.mrp * item.quantity;
      return `
      <tr>
        <td>${esc(item.medicineName)}</td>
        <td class="center">${esc(item.pack || "-")}</td>
        <td class="center">${item.quantity}</td>
        <td class="center">${esc(item.batchNo)}</td>
        <td class="center">${formatExpiry(item.expiryDate)}</td>
        <td class="right">${item.mrp.toFixed(2)}</td>
        <td class="right">${amount.toFixed(2)}</td>
        <td class="center">EXPIRY</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Expiry Return — ${esc(data.supplierName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; font-size: 13px; }
  h1 { font-size: 15px; text-align: center; text-decoration: underline; letter-spacing: 1px; margin: 0 0 20px; }
  .field { margin-bottom: 8px; }
  .field .label { font-weight: bold; }
  .blank-line { display: inline-block; min-width: 220px; border-bottom: 1px solid #111; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #111; padding: 5px 6px; font-size: 12px; }
  th { background: #eee; text-align: left; }
  .center { text-align: center; }
  .right { text-align: right; }
  @media print { @page { margin: 12mm; size: A4; } }
</style>
</head>
<body>
  <h1>DETAILS OF EXPIRY / LEAKAGE / BREAKAGE</h1>
  <div class="field"><span class="label">Firm Name:</span> ${esc(data.firmName || "")}</div>
  <div class="field"><span class="label">Date:</span> <span class="blank-line">&nbsp;</span></div>
  <div class="field"><span class="label">D.L. No:</span> ${esc(data.dlNo || "")}</div>
  <div class="field"><span class="label">Mobile No:</span> ${esc(data.mobile || "")}</div>
  <div class="field"><span class="label">To:</span> <span class="blank-line">&nbsp;</span></div>
  <div class="field">KINDLY RECEIVE THE FOLLOWING GOODS:</div>
  <table>
    <thead>
      <tr>
        <th>NAME OF PRODUCT</th>
        <th>PACK</th>
        <th>QTY</th>
        <th>BATCH</th>
        <th>EXPIRY</th>
        <th>MRP</th>
        <th>AMOUNT</th>
        <th>REMARK</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    throw new Error("Popup blocked — allow popups for this site to print reports.");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
