import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import DashboardCard from "../components/DashboardCard.jsx";
import ExpensesChart from "../components/ExpensesChart.jsx";
import { demoDashboardData } from "../data/demoDashboardData.js";
import { getDashboardData } from "../services/dashboardApi.js";
import {
  calculatePurchaseTotals,
  formatCurrency,
  normalizeDashboardData
} from "../utils/dashboardCalculations.js";

export default function DashboardPage({
  user,
  onLogout,
  onOpenClients,
  onOpenSuppliers,
  onOpenVouchers,
  onOpenSales,
  onOpenPurchases,
  onOpenOutsideServices,
  onOpenAdmin,
  onOpenMonitoring,
  voucherCount
}) {
  const [dashboardData, setDashboardData] = useState(() =>
    normalizeDashboardData(demoDashboardData)
  );
  const [dataSource, setDataSource] = useState("loading");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    getDashboardData(new Date().getFullYear())
      .then((result) => {
        if (!active) return;
        setDashboardData(result.data);
        setDataSource(result.source);
      })
      .catch((error) => {
        if (!active) return;
        setDataSource("error");
        setNotice(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const purchaseTotals = useMemo(
    () => calculatePurchaseTotals(dashboardData.monthlyExpenses),
    [dashboardData.monthlyExpenses]
  );

  return (
    <div className="app-page dashboard-page">
      <Header user={user} onLogout={onLogout} />

      <main className="dashboard" aria-labelledby="dashboardTitle">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">Company Management System</p>
            <h1 id="dashboardTitle">Dashboard</h1>
          </div>
          <span className={`data-badge data-badge--${dataSource}`}>
            {dataSource === "live"
              ? "Live data"
              : dataSource === "error"
                ? "API error"
                : dataSource === "loading"
                  ? "Loading"
                  : "Demo data"}
          </span>
        </div>

        <section className="dashboard-menu" aria-label="Company records">
          <DashboardCard label="Clients Track Records" onClick={onOpenClients} />
          <DashboardCard label="Suppliers Track Records" onClick={onOpenSuppliers} />
          {user.role === "admin" && (
            <DashboardCard className="admin-dashboard-card" label="Manage User Accounts" onClick={onOpenAdmin} />
          )}
        </section>

        <section className="analytics-card" aria-labelledby="analyticsTitle">
          <h2
            className="analytics-heading"
            id="analyticsTitle"
          >
            Monthly Expenses Analytics
          </h2>
          <ExpensesChart monthlyExpenses={dashboardData.monthlyExpenses} />
          <div className="analytics-totals" aria-label="Expense analytics totals">
            <div>
              <span>Supplier Payables</span>
              <strong>{formatCurrency(purchaseTotals.payablePurchases)}</strong>
            </div>
            <button className="analytics-total-card" type="button" onClick={onOpenOutsideServices}>
              <span>Outside Services</span>
              <strong>{formatCurrency(purchaseTotals.outsideServices)}</strong>
              <small>View records</small>
            </button>
            <div>
              <span>Total Expenses</span>
              <strong>{formatCurrency(purchaseTotals.totalExpenses)}</strong>
            </div>
          </div>
        </section>

        <section className="totals-card" aria-label="Sales and purchase summaries">
          <DashboardCard
            className="summary-card"
            label="Total Sales"
            onClick={onOpenSales}
          />
          <DashboardCard
            className="summary-card"
            label="Total Purchase"
            onClick={onOpenPurchases}
          />
        </section>

        <section className={`dashboard-actions ${user.role === "admin" ? "has-admin-monitoring" : ""}`} aria-label="Voucher and administration">
          <DashboardCard
            className="cheque-card"
            label="Voucher Cheque"
            value={`${dashboardData.voucherCounts?.total ?? voucherCount ?? 0} total`}
            onClick={onOpenVouchers}
          />
          {user.role === "admin" && (
            <DashboardCard className="monitoring-dashboard-card" label="Admin Monitoring" onClick={onOpenMonitoring} />
          )}
        </section>
      </main>

      {notice && <div className="dashboard-notice" role="status">{notice}</div>}

    </div>
  );
}
