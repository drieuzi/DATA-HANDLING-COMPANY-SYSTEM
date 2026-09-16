export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeDashboardData(data) {
  return {
    totalSales: toNumber(data.totalSales),
    receivables: toNumber(data.receivables),
    payables: toNumber(data.payables),
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
