import TrackRecordHeader from "../components/TrackRecordHeader.jsx";

export default function ClientsPage({ clients, onBack, onSelectClient }) {
  return (
    <div className="app-page client-page">
      <TrackRecordHeader
        title="Client Track Record"
        backLabel="Back to dashboard"
        onBack={onBack}
      />

      <main className="client-list-main">
        <section className="client-list-card" aria-labelledby="clientListTitle">
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

                <span
                  className={`client-status client-status--${client.billingStatus
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {client.billingStatus}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
