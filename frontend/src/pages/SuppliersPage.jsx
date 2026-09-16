import TrackRecordHeader from "../components/TrackRecordHeader.jsx";

export default function SuppliersPage({ suppliers, onBack, onSelectSupplier }) {
  return (
    <div className="app-page supplier-page">
      <TrackRecordHeader
        title="Supplier Track Record"
        backLabel="Back to dashboard"
        onBack={onBack}
      />

      <main className="supplier-list-main">
        <section className="supplier-list-card" aria-labelledby="supplierListTitle">
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

                <span
                  className={`supplier-status supplier-status--${supplier.billingStatus
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {supplier.billingStatus}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
