const pool = require("../config/db");
const HttpError = require("../utils/httpError");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function dashboard(request, response, next) {
  try {
    const year = Number(request.query.year || new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "Enter a valid dashboard year.");
    }

    const [
      transactionTotals,
      clientTotals,
      paymentTotals,
      monthlyResult,
      outsideServiceTotals,
      outsideServiceMonthly,
      voucherResult
    ] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE billing_status = 'Paid'), 0) AS total_purchases,
           COALESCE(SUM(balance), 0) AS total_unpaid_payables,
           COUNT(*) FILTER (WHERE billing_status = 'Paid')::INTEGER AS paid_count,
           COUNT(*) FILTER (WHERE billing_status = 'Not Paid')::INTEGER AS not_paid_count
         FROM supplier_transactions WHERE deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_sales,
           COALESCE(SUM(balance), 0) AS total_receivables
         FROM client_transactions WHERE deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS current_month_expenses
         FROM payments
         WHERE reversed_at IS NULL
           AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM payment_date)::INTEGER AS month_number,
           COALESCE(SUM(amount), 0) AS total
         FROM payments
         WHERE reversed_at IS NULL AND EXTRACT(YEAR FROM payment_date) = $1
         GROUP BY month_number ORDER BY month_number`,
        [year]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS current_month_expenses
         FROM outside_services
         WHERE DATE_TRUNC('month', service_date) = DATE_TRUNC('month', CURRENT_DATE)`
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM service_date)::INTEGER AS month_number,
           COALESCE(SUM(amount), 0) AS total
         FROM outside_services
         WHERE EXTRACT(YEAR FROM service_date) = $1
         GROUP BY month_number ORDER BY month_number`,
        [year]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::INTEGER AS total,
           COUNT(*) FILTER (WHERE payment_status = 'Draft' AND deleted_at IS NULL)::INTEGER AS draft,
           COUNT(*) FILTER (WHERE payment_status = 'Issued' AND deleted_at IS NULL)::INTEGER AS issued,
           COUNT(*) FILTER (WHERE payment_status = 'Cancelled' AND deleted_at IS NULL)::INTEGER AS cancelled,
           COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::INTEGER AS deleted
         FROM vouchers`
      )
    ]);

    const monthlyMap = new Map(monthlyResult.rows.map((row) => [row.month_number, Number(row.total)]));
    const outsideServiceMap = new Map(
      outsideServiceMonthly.rows.map((row) => [row.month_number, Number(row.total)])
    );
    const totals = transactionTotals.rows[0];
    const salesTotals = clientTotals.rows[0];
    response.json({
      year,
      totalSales: Number(salesTotals.total_sales),
      receivables: Number(salesTotals.total_receivables),
      totalPurchases: Number(totals.total_purchases),
      payables: Number(totals.total_unpaid_payables),
      paidTransactions: totals.paid_count,
      notPaidTransactions: totals.not_paid_count,
      currentMonthExpenses:
        Number(paymentTotals.rows[0].current_month_expenses)
        + Number(outsideServiceTotals.rows[0].current_month_expenses),
      voucherCounts: voucherResult.rows[0],
      monthlyExpenses: MONTHS.map((month, index) => ({
        month,
        payables: monthlyMap.get(index + 1) || 0,
        outsideServices: outsideServiceMap.get(index + 1) || 0
      }))
    });
  } catch (error) { next(error); }
}

module.exports = { dashboard };
