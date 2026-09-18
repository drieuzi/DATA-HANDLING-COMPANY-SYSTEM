import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PayablesPage from "./PayablesPage.jsx";

export default function SuppliersPage({
  suppliers,
  onBack,
  onSelectSupplier,
  onSaveTransaction,
  activeTab,
  onTabChange
}) {
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
              suppliers={suppliers}
              onSaveTransaction={onSaveTransaction}
              embedded
            />
          </div>
        ) : (
          <section
            className="supplier-list-card record-list-card"
            id="supplier-names-panel"
            role="tabpanel"
            aria-labelledby="supplier-names-tab"
          >
            <div className="supplier-list-heading" id="supplierListTitle">
              <span>Supplier Names</span>
              <span>Billing Status</span>
            </div>

            <div className="supplier-list" role="list">
              {suppliers.map((supplier) => (
                <div className="supplier-row" role="listitem" key={supplier.id}>
                  <button
                    className="supplier-name-button"
                    type="button"
                    onClick={() => onSelectSupplier(supplier)}
                    aria-label={`Open ${supplier.name} supplier records`}
                  >
                    {supplier.name}
                  </button>
                  <span className={`supplier-status supplier-status--${supplier.billingStatus.toLowerCase().replaceAll(" ", "-")}`}>
                    {supplier.billingStatus}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
