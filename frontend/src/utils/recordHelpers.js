export function createRecordId(prefix) {
  const uniquePart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}-${uniquePart}`;
}

export function calculateBillingStatus(amount, balance) {
  const safeAmount = Math.max(Number(amount) || 0, 0);
  const safeBalance = Math.min(Math.max(Number(balance) || 0, 0), safeAmount);

  if (safeBalance === 0) return "Paid";
  if (safeBalance < safeAmount) return "Partially Paid";
  return "Not Paid";
}

export function calculateCompanyStatus(transactions) {
  if (!transactions.length) return "Not Paid";
  if (transactions.every((transaction) => transaction.billingStatus === "Paid")) return "Paid";
  if (transactions.some((transaction) => transaction.billingStatus !== "Not Paid")) {
    return "Partially Paid";
  }
  return "Not Paid";
}

export function getNextVoucherNumber(vouchers) {
  const highestNumber = vouchers.reduce((highest, voucher) => {
    const numericValue = Number.parseInt(String(voucher.voucherNumber).replace(/\D/g, ""), 10);
    return Number.isFinite(numericValue) ? Math.max(highest, numericValue) : highest;
  }, 140);

  return String(highestNumber + 1).padStart(6, "0");
}

export function formatRecordDate(value) {
  if (!value || value === "—") return "—";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
