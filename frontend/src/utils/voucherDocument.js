const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wordsBelowThousand(value) {
  let number = value;
  const words = [];
  if (number >= 100) {
    words.push(`${ONES[Math.floor(number / 100)]} hundred`);
    number %= 100;
  }
  if (number >= 20) {
    words.push(`${TENS[Math.floor(number / 10)]}${number % 10 ? `-${ONES[number % 10]}` : ""}`);
  } else if (number > 0) {
    words.push(ONES[number]);
  }
  return words.join(" ");
}

function numberToWords(value) {
  let number = Math.floor(Math.abs(Number(value) || 0));
  if (number === 0) return "zero";
  const groups = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"]
  ];
  const words = [];
  groups.forEach(([size, label]) => {
    if (number >= size) {
      words.push(`${wordsBelowThousand(Math.floor(number / size))} ${label}`);
      number %= size;
    }
  });
  if (number) words.push(wordsBelowThousand(number));
  return words.join(" ");
}

function moneyInWords(value) {
  const amount = Math.max(Number(value) || 0, 0);
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  return `${numberToWords(pesos)} pesos${centavos ? ` and ${String(centavos).padStart(2, "0")}/100` : " only"}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value || value === "—") return "";
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function downloadVoucherForPrint({ voucher, supplier, transaction, preparedBy }) {
  const printWindow = window.open("", "_blank", "width=1200,height=850");
  if (!printWindow) {
    throw new Error("The printable voucher was blocked. Allow pop-ups for this website, then try Download again.");
  }
  printWindow.opener = null;

  const amount = Number(voucher.amountApplied || 0);
  const withholdingTaxRate = Number(voucher.withholdingTaxRate || 0);
  const withholdingTaxAmount = Number.isFinite(Number(voucher.withholdingTaxAmount))
    ? Number(voucher.withholdingTaxAmount)
    : Math.round(amount * withholdingTaxRate * 100) / 100;
  const netChequeAmount = Number.isFinite(Number(voucher.netChequeAmount))
    ? Number(voucher.netChequeAmount)
    : Math.max(amount - withholdingTaxAmount, 0);
  const totalCreditAmount = Math.round((withholdingTaxAmount + netChequeAmount) * 100) / 100;
  // The printed Amount and its words must describe the same cheque value.
  const voucherDisplayAmount = netChequeAmount;
  const bankName = voucher.bankName?.trim() || "Bank used";
  const supplierName = supplier?.name || voucher.supplierName || "";
  const contactPerson = supplier?.contactPerson || "";
  const purchaseOrder = transaction?.purchaseOrder || voucher.purchaseOrder || "";
  const salesInvoice = transaction?.salesInvoice || voucher.salesInvoice || "";
  const paymentReference = [
    salesInvoice && salesInvoice !== "—" ? `S.I. ${salesInvoice}` : "",
    purchaseOrder && purchaseOrder !== "—" ? `P.O. ${purchaseOrder}` : ""
  ].filter(Boolean).join(" / ");
  const particulars = paymentReference
    ? `Payment for ${paymentReference}`
    : (voucher.particulars?.trim() || "Payment for supplier transaction");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Voucher ${escapeHtml(voucher.voucherNumber)}</title>
  <style>
    @page { size: A4 landscape; margin: 9mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f5f5; color: #111; font-family: Arial, Helvetica, sans-serif; }
    .screen-actions { display: flex; justify-content: center; gap: 12px; padding: 14px; }
    .screen-actions button { padding: 10px 20px; border: 2px solid #111; border-radius: 999px; background: #111; color: #fff; font: 700 14px Arial; cursor: pointer; }
    .voucher { width: 277mm; min-height: 185mm; margin: 0 auto 20px; padding: 16mm 18mm 12mm; background: #ff9a0a; }
    .brand { text-align: center; }
    .company-name { margin: 0; font-size: 32px; font-weight: 900; letter-spacing: .24em; text-transform: uppercase; }
    .brand-subtitle { margin: 4px 0 7px; font-size: 11px; letter-spacing: .45em; }
    .address { margin: 0 0 18px; font-size: 10px; letter-spacing: .24em; }
    .voucher-meta { display: grid; grid-template-columns: 1.25fr .75fr; gap: 30px; margin: 0 10mm 11px; font-size: 12px; }
    .field-line { display: grid; grid-template-columns: max-content 1fr; gap: 8px; margin: 4px 0; align-items: end; }
    .line-value { min-height: 18px; padding: 0 4px 3px; border-bottom: 2px solid #111; font-weight: 700; }
    .voucher-body { border: 2px solid #111; }
    .top-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .top-grid > div { min-height: 34px; padding: 8px 12px; border-bottom: 2px solid #111; }
    .top-grid > div:nth-child(odd) { border-right: 2px solid #111; }
    .amount-value { text-align: center; font-weight: 700; }
    .payment-for { text-align: center; }
    .body-grid { display: grid; grid-template-columns: 1.08fr 1fr; min-height: 92mm; }
    .distribution { border-right: 2px solid #111; }
    .section-title { margin: 0; padding: 10px 12px; font-size: 12px; letter-spacing: .12em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { height: 29px; padding: 6px 9px; border: 2px solid #111; border-left: 0; font-size: 11px; text-align: left; }
    th:last-child, td:last-child { border-right: 0; }
    th { font-weight: 700; text-align: center; }
    .numeric { text-align: right; }
    .details { display: flex; flex-direction: column; padding: 10px 14px; }
    .words { min-height: 46px; margin: 0 0 20px; line-height: 1.7; }
    .words strong { margin-right: 8px; }
    .cheque-fields { width: 70%; margin: auto 0 10px auto; }
    .received { margin-top: auto; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28mm; padding-top: 12px; }
    .signature { min-height: 48px; font-size: 11px; }
    .signature-name { min-height: 24px; margin-top: 4px; padding: 5px 3px 2px; border-bottom: 2px solid #111; font-weight: 700; }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .screen-actions { display: none; }
      .voucher { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="screen-actions"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
  <article class="voucher">
    <header class="brand">
      <h1 class="company-name">ILLUMINUX</h1>
      <p class="brand-subtitle">General Merch Co.</p>
      <p class="address">Blk. 4, Queenstown 1 Heights, Brgy. San Luis, Antipolo City</p>
    </header>
    <section class="voucher-meta">
      <div>
        <div class="field-line"><span>Company name of supplier</span><span class="line-value">${escapeHtml(supplierName)}</span></div>
      </div>
      <div>
        <div class="field-line"><span>Voucher no.</span><span class="line-value">${escapeHtml(voucher.voucherNumber)}</span></div>
        <div class="field-line"><span>Date</span><span class="line-value">${escapeHtml(formatDate(voucher.voucherDate))}</span></div>
      </div>
    </section>
    <section class="voucher-body">
      <div class="top-grid">
        <div><strong>Contact person:</strong> ${escapeHtml(contactPerson)}</div>
        <div class="amount-value"><strong>Amount</strong></div>
        <div class="payment-for">${escapeHtml(particulars)}</div>
        <div class="amount-value">${escapeHtml(formatMoney(voucherDisplayAmount))}</div>
      </div>
      <div class="body-grid">
        <div class="distribution">
          <p class="section-title">Distribution of account</p>
          <table>
            <thead><tr><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
            <tbody>
              <tr><td>Accounts payable – trade</td><td class="numeric">${escapeHtml(formatMoney(totalCreditAmount))}</td><td></td></tr>
              <tr><td>${escapeHtml(paymentReference || "Supplier transaction")}</td><td></td><td></td></tr>
              <tr><td>Withholding tax (1%)</td><td></td><td class="numeric">${escapeHtml(formatMoney(withholdingTaxAmount))}</td></tr>
              <tr><td>${escapeHtml(bankName)}</td><td></td><td class="numeric">${escapeHtml(formatMoney(netChequeAmount))}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="details">
          <p class="words"><strong>Pesos:</strong> ${escapeHtml(moneyInWords(voucherDisplayAmount))}</p>
          <div class="cheque-fields">
            <div class="field-line"><span>Cheque date</span><span class="line-value">${escapeHtml(formatDate(voucher.chequeDate))}</span></div>
            <div class="field-line"><span>Cheque no.</span><span class="line-value">${escapeHtml(voucher.chequeNumber || "")}</span></div>
          </div>
          <div class="field-line received"><span>Received payment by</span><span class="line-value"></span></div>
        </div>
      </div>
    </section>
    <footer class="signatures">
      <div class="signature"><span>Prepared by</span><div class="signature-name">${escapeHtml(preparedBy || "")}</div></div>
      <div class="signature"><span>Checked by</span><div class="signature-name">Lucia Baranda</div></div>
      <div class="signature"><span>Approved by</span><div class="signature-name">Randy D. Deauna</div></div>
    </footer>
  </article>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
}
