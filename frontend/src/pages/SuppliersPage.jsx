import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import SupplierEditorDialog from "../components/SupplierEditorDialog.jsx";
import PayablesPage from "./PayablesPage.jsx";

export default function SuppliersPage({
  suppliers,
  onBack,
  onSelectSupplier,
  onSaveTransaction,
  onDeleteTransaction,
  user,
  onSaveSupplier,
  onDeleteSupplier,
  onRestoreSupplier,
  activeTab,
  onTabChange
}) {
  const [supplierEditor, setSupplierEditor] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isAdmin = user?.role === "admin";
  const visibleSuppliers = suppliers
    .filter((supplier) => isAdmin || !supplier.deletedAt)
    .filter((supplier) => supplier.name.toLowerCase().includes(companySearch.trim().toLowerCase()))
    .filter((supplier) => {
      if (statusFilter === "all") return true;
      const status = supplier.deletedAt ? "deleted" : supplier.billingStatus?.toLowerCase();
      return status === statusFilter;
    });

  return (
    <div className="app-page supplier-page">
      <TrackRecordHeader
        title="Suppliers Track Records"
      />

      <main className="record-section-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <div className="record-tabs" role="tablist" aria-label="Supplier record sections">
          <button
            id="supplier-payables-tab"
            className={activeTab === "payables" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "payables"}
            aria-controls="supplier-payables-panel"
            onClick={() => onTabChange("payables")}
          >
            Payables
          </button>
          <button
            id="supplier-names-tab"
            className={activeTab === "suppliers" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "suppliers"}
            aria-controls="supplier-names-panel"
            onClick={() => onTabChange("suppliers")}
          >
            Supplier Names and Records
          </button>
        </div>

        {activeTab === "payables" ? (
          <div id="supplier-payables-panel" role="tabpanel" aria-labelledby="supplier-payables-tab">
            <PayablesPage
              suppliers={suppliers.filter((supplier) => !supplier.deletedAt)}
              onSaveTransaction={onSaveTransaction}
              onDeleteTransaction={onDeleteTransaction}
              isAdmin={isAdmin}
              embedded
            />
          </div>
        ) : (
          <div id="supplier-names-panel" role="tabpanel" aria-labelledby="supplier-names-tab">
            <div className="management-toolbar"><span>{isAdmin ? "Admin supplier controls" : "Employee supplier controls"}</span><button className="primary-action" type="button" onClick={() => { setSupplierEditor(null); setEditorOpen(true); }}>+ Add Supplier</button></div>
            <section className="supplier-list-card record-list-card" aria-labelledby="supplierListTitle">
              <div className="company-list-filters">
                <label>
                  <span>Search company</span>
                  <input
                    type="search"
                    value={companySearch}
                    placeholder="Search supplier name"
                    onChange={(event) => setCompanySearch(event.target.value)}
                  />
                </label>
                <label>
                  <span>Billing status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="not paid">Not Paid</option>
                    {isAdmin && <option value="deleted">Deleted</option>}
                  </select>
                </label>
              </div>

              <div className="company-list-table-wrapper">
                <table className="company-list-table">
                  <thead>
                    <tr id="supplierListTitle">
                      <th scope="col">Supplier name</th>
                      <th scope="col">Billing status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSuppliers.map((supplier) => (
                      <tr className={supplier.deletedAt ? "is-deleted" : ""} key={supplier.id}>
                        <td>
                          <button
                            className="supplier-name-button"
                            type="button"
                            onClick={() => !supplier.deletedAt && onSelectSupplier(supplier)}
                            disabled={Boolean(supplier.deletedAt)}
                            aria-label={`Open ${supplier.name} supplier records`}
                          >
                            {supplier.name}
                          </button>
                        </td>
                        <td>
                          <div className="supplier-row-controls">
                            <span className={`supplier-status supplier-status--${supplier.billingStatus?.toLowerCase().replaceAll(" ", "-") || "not-paid"}`}>{supplier.deletedAt ? "Deleted" : supplier.billingStatus}</span>
                            {isAdmin && supplier.deletedAt && supplier.restoreAllowed !== false && <div className="row-actions"><button type="button" onClick={async () => { try { await onRestoreSupplier(supplier.id); } catch (error) { window.alert(error.message); } }}>Restore</button></div>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visibleSuppliers.length === 0 && (
                      <tr><td className="company-list-empty" colSpan="2">No suppliers match the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
      <SupplierEditorDialog isOpen={editorOpen} supplier={supplierEditor} onSave={(values) => onSaveSupplier(supplierEditor?.id, values)} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
