import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import DashboardCard from "../components/DashboardCard.jsx";
import ExpensesChart from "../components/ExpensesChart.jsx";
import PurchaseDialog from "../components/PurchaseDialog.jsx";
import { demoDashboardData } from "../data/demoDashboardData.js";
import { getDashboardData } from "../services/dashboardApi.js";
import {
  calculatePurchaseTotals,
  formatCurrency,
  normalizeDashboardData
} from "../utils/dashboardCalculations.js";

const MODULE_LABELS = {
  clients: "Clients",
  suppliers: "Suppliers",
  receivables: "Receivables",
  payables: "Payables",
  sales: "Total Sales",
  cheques: "Cheque",
  analytics: "Monthly Expenses Analytics"
};

export default function DashboardPage({ user, onLogout }) {
  const [dashboardData, setDashboardData] = useState(() =>
    normalizeDashboardData(demoDashboardData)
  );
  const [dataSource, setDataSource] = useState("loading");
  const [notice, setNotice] = useState("");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

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

  function openFutureModule(moduleName) {
    setNotice(`${MODULE_LABELS[moduleName]} module is prepared for the next development step.`);
  }

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
          <DashboardCard label="Clients" onClick={() => openFutureModule("clients")} />
          <DashboardCard label="Suppliers" onClick={() => openFutureModule("suppliers")} />
          <DashboardCard
            label="Receivable"
            value={formatCurrency(dashboardData.receivables)}
            onClick={() => openFutureModule("receivables")}
          />
          <DashboardCard
            label="Payables"
            value={formatCurrency(dashboardData.payables)}
            onClick={() => openFutureModule("payables")}
          />
        </section>

        <section className="analytics-card" aria-labelledby="analyticsTitle">
          <button
            className="analytics-heading"
            id="analyticsTitle"
            type="button"
            onClick={() => openFutureModule("analytics")}
          >
            Monthly Expenses Analytics
          </button>
          <ExpensesChart monthlyExpenses={dashboardData.monthlyExpenses} />
        </section>

        <section className="totals-card" aria-label="Sales and purchase summaries">
          <DashboardCard
            className="summary-card"
            label="Total Sales"
            value={formatCurrency(dashboardData.totalSales)}
            onClick={() => openFutureModule("sales")}
          />
          <DashboardCard
            className="summary-card"
            label="Total Purchase"
            value={formatCurrency(purchaseTotals.totalPurchases)}
            onClick={() => setPurchaseDialogOpen(true)}
          />
        </section>

        <DashboardCard
          className="cheque-card"
          label="Cheque"
          value={formatCurrency(dashboardData.chequeTotal)}
          onClick={() => openFutureModule("cheques")}
        />
      </main>

      {notice && <div className="dashboard-notice" role="status">{notice}</div>}

      <PurchaseDialog
        isOpen={purchaseDialogOpen}
        totals={purchaseTotals}
        onClose={() => setPurchaseDialogOpen(false)}
      />
    </div>
  );
}
