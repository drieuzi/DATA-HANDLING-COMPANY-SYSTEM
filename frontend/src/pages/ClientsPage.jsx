import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import ReceivablesPage from "./ReceivablesPage.jsx";

export default function ClientsPage({
  clients,
  onBack,
  onSelectClient,
  onSaveTransaction,
  activeTab,
  onTabChange
}) {
  return (
    <div className="app-page client-page">
      <TrackRecordHeader
        title="Clients Track Records"
        backLabel="Back to dashboard"
        onBack={onBack}
      />

      <main className="record-section-main">
        <div className="record-tabs" role="tablist" aria-label="Client record sections">
          <button
            id="client-receivables-tab"
            className={activeTab === "receivables" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "receivables"}
            aria-controls="client-receivables-panel"
            onClick={() => onTabChange("receivables")}
          >
            Receivables
          </button>
          <button
            id="client-names-tab"
            className={activeTab === "clients" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "clients"}
            aria-controls="client-names-panel"
            onClick={() => onTabChange("clients")}
          >
            Client Names and Records
          </button>
        </div>

        {activeTab === "receivables" ? (
          <div id="client-receivables-panel" role="tabpanel" aria-labelledby="client-receivables-tab">
            <ReceivablesPage
              clients={clients}
              onSaveTransaction={onSaveTransaction}
              embedded
            />
          </div>
        ) : (
          <section
            className="client-list-card record-list-card"
            id="client-names-panel"
            role="tabpanel"
            aria-labelledby="client-names-tab"
          >
            <div className="client-list-heading" id="clientListTitle">
              <span>Client Names</span>
              <span>Billing Status</span>
            </div>

            <div className="client-list" role="list">
              {clients.map((client) => (
                <div className="client-row" role="listitem" key={client.id}>
                  <button
                    className="client-name-button"
                    type="button"
                    onClick={() => onSelectClient(client)}
                    aria-label={`Open ${client.name} client records`}
                  >
                    {client.name}
                  </button>
                  <span className={`client-status client-status--${client.billingStatus.toLowerCase().replaceAll(" ", "-")}`}>
                    {client.billingStatus}
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
