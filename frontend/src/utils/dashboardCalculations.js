export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function createEmptyDashboardData() {
  return {
    totalSales: 0,
    receivables: 0,
    payables: 0,
    totalPurchases: 0,
    currentMonthExpenses: 0,
    paidTransactions: 0,
    notPaidTransactions: 0,
    voucherCounts: { total: 0, draft: 0, issued: 0, cancelled: 0, deleted: 0 },
    monthlyExpenses: MONTHS.map((month) => ({
      month,
      payables: 0,
      outsideServices: 0
    }))
  };
}

export function normalizeDashboardData(data) {
  return {
    totalSales: toNumber(data.totalSales),
    receivables: toNumber(data.receivables),
    payables: toNumber(data.payables),
    totalPurchases: toNumber(data.totalPurchases),
    currentMonthExpenses: toNumber(data.currentMonthExpenses),
    paidTransactions: toNumber(data.paidTransactions),
    notPaidTransactions: toNumber(data.notPaidTransactions),
    voucherCounts: data.voucherCounts || { total: 0, draft: 0, issued: 0, cancelled: 0, deleted: 0 },
    monthlyExpenses: Array.isArray(data.monthlyExpenses)
      ? data.monthlyExpenses.map((item) => ({
          month: String(item.month || ""),
          payables: toNumber(item.payables),
          outsideServices: toNumber(item.outsideServices)
        }))
      : []
  };
}

export function calculatePurchaseTotals(monthlyExpenses) {
  return monthlyExpenses.reduce(
    (totals, month) => ({
      payablePurchases: totals.payablePurchases + month.payables,
      outsideServices: totals.outsideServices + month.outsideServices,
      totalExpenses: totals.totalExpenses + month.payables + month.outsideServices
    }),
    { payablePurchases: 0, outsideServices: 0, totalExpenses: 0 }
  );
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(value);
}
