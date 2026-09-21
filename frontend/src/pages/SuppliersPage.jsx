import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
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
  const isAdmin = user?.role === "admin";

  return (
    <div className="app-page supplier-page">
      <TrackRecordHeader
        title="Suppliers Track Records"
        backLabel="Back to dashboard"
        onBack={onBack}
      />

      <main className="record-section-main">
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
            <section className="supplier-list-card record-list-card">
            <div className="supplier-list-heading" id="supplierListTitle">
              <span>Supplier Names</span>
              <span>Billing Status</span>
            </div>

            <div className="supplier-list" role="list">
              {suppliers.map((supplier) => (
                <div className={`supplier-row ${supplier.deletedAt ? "is-deleted" : ""}`} role="listitem" key={supplier.id}>
                  <button
                    className="supplier-name-button"
                    type="button"
                    onClick={() => !supplier.deletedAt && onSelectSupplier(supplier)}
                    disabled={Boolean(supplier.deletedAt)}
                    aria-label={`Open ${supplier.name} supplier records`}
                  >
                    {supplier.name}
                  </button>
                  <div className="supplier-row-controls">
                    <span className={`supplier-status supplier-status--${supplier.billingStatus.toLowerCase().replaceAll(" ", "-")}`}>{supplier.deletedAt ? "Deleted" : supplier.billingStatus}</span>
                    {isAdmin && supplier.deletedAt && <div className="row-actions"><button type="button" onClick={async () => { try { await onRestoreSupplier(supplier.id); } catch (error) { window.alert(error.message); } }}>Restore</button></div>}
                  </div>
                </div>
              ))}
            </div>
            </section>
          </div>
        )}
      </main>
      <SupplierEditorDialog isOpen={editorOpen} supplier={supplierEditor} onSave={(values) => onSaveSupplier(supplierEditor?.id, values)} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
