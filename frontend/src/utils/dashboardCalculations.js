export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeDashboardData(data) {
  return {
    totalSales: toNumber(data.totalSales),
    receivables: toNumber(data.receivables),
    payables: toNumber(data.payables),
    chequeTotal: toNumber(data.chequeTotal),
    monthlyExpenses: Array.isArray(data.monthlyExpenses)
      ? data.monthlyExpenses.map((item) => ({
          month: String(item.month || ""),
          companyTransactions: toNumber(item.companyTransactions),
          outsideServices: toNumber(item.outsideServices)
        }))
      : []
  };
}

export function calculatePurchaseTotals(monthlyExpenses) {
  return monthlyExpenses.reduce(
    (totals, month) => ({
      companyTransactions: totals.companyTransactions + month.companyTransactions,
      outsideServices: totals.outsideServices + month.outsideServices,
      totalPurchases:
        totals.totalPurchases + month.companyTransactions + month.outsideServices
    }),
    { companyTransactions: 0, outsideServices: 0, totalPurchases: 0 }
  );
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(value);
}
