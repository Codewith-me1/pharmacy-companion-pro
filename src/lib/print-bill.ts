export type PrintBillData = {
  billNumber: string;
  billType: string;
  createdAt: string;
  customerName?: string | null;
  doctorName?: string | null;
  paymentMode: string;
  items: { medicineName: string; batchNo?: string | null; quantity: number; salePrice: number }[];
  subtotal: number;
  gstAmount: number;
  discount: number;
  total: number;
};

function esc(value: string) {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

function money(value: number) {
  return `Rs. ${value.toFixed(2)}`;
}

export function printBill(bill: PrintBillData) {
  const rows = bill.items
    .map(
      (item) => `
      <tr>
        <td>${esc(item.medicineName)}${item.batchNo ? ` <span class="muted">(${esc(item.batchNo)})</span>` : ""}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${money(item.salePrice)}</td>
        <td class="right">${money(item.salePrice * item.quantity)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Bill ${esc(bill.billNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; padding: 16px; color: #111; max-width: 380px; margin: 0 auto; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .center { text-align: center; }
  .muted { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { padding: 4px 2px; text-align: left; border-bottom: 1px dashed #999; }
  .right { text-align: right; }
  .totals td { border: none; padding: 2px; }
  .totals tr:last-child td { font-weight: bold; font-size: 14px; border-top: 1px solid #111; padding-top: 6px; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  @media print { @page { margin: 8mm; } }
</style>
</head>
<body>
  <h1>MediOS Pharmacy</h1>
  <p class="center muted">Smart Pharmacy OS &middot; Bill #${esc(bill.billNumber)}</p>
  <hr />
  <p class="muted">
    Date: ${esc(bill.createdAt)}<br />
    Type: ${esc(bill.billType.toUpperCase())} &nbsp; Payment: ${esc(bill.paymentMode.toUpperCase())}<br />
    ${bill.customerName ? `Customer: ${esc(bill.customerName)}<br />` : ""}
    ${bill.doctorName ? `Doctor: Dr. ${esc(bill.doctorName)}<br />` : ""}
  </p>
  <table>
    <thead>
      <tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amt</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="right">${money(bill.subtotal)}</td></tr>
    <tr><td>GST</td><td class="right">${money(bill.gstAmount)}</td></tr>
    <tr><td>Discount</td><td class="right">-${money(bill.discount)}</td></tr>
    <tr><td>Total</td><td class="right">${money(bill.total)}</td></tr>
  </table>
  <hr />
  <p class="center muted">Thank you! Get well soon.</p>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=420,height=640");
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
