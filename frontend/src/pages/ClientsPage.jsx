import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import ClientEditorDialog from "../components/ClientEditorDialog.jsx";
import ReceivablesPage from "./ReceivablesPage.jsx";

export default function ClientsPage({
  clients,
  onBack,
  onSelectClient,
  onSaveTransaction,
  onDeleteTransaction,
  onReceivePayment,
  user,
  onSaveClient,
  onDeleteClient,
  onRestoreClient,
  activeTab,
  onTabChange
}) {
  const [clientEditor, setClientEditor] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const isAdmin = user?.role === "admin";

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
              clients={clients.filter((client) => !client.deletedAt)}
              onSaveTransaction={onSaveTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onReceivePayment={onReceivePayment}
              isAdmin={isAdmin}
              embedded
            />
          </div>
        ) : (
          <div id="client-names-panel" role="tabpanel" aria-labelledby="client-names-tab">
            <div className="management-toolbar"><span>{isAdmin ? "Admin client controls" : "Employee client controls"}</span><button className="primary-action" type="button" onClick={() => { setClientEditor(null); setEditorOpen(true); }}>+ Add Client</button></div>
          <section
            className="client-list-card record-list-card"
          >
            <div className="client-list-heading" id="clientListTitle">
              <span>Client Names</span>
              <span>Billing Status</span>
            </div>

            <div className="client-list" role="list">
              {clients.map((client) => (
                <div className={`client-row ${client.deletedAt ? "is-deleted" : ""}`} role="listitem" key={client.id}>
                  <button
                    className="client-name-button"
                    type="button"
                    onClick={() => !client.deletedAt && onSelectClient(client)}
                    disabled={Boolean(client.deletedAt)}
                    aria-label={`Open ${client.name} client records`}
                  >
                    {client.name}
                  </button>
                  <div className="client-row-controls">
                    <span className={`client-status client-status--${client.billingStatus.toLowerCase().replaceAll(" ", "-")}`}>{client.deletedAt ? "Deleted" : client.billingStatus}</span>
                    {isAdmin && client.deletedAt && <div className="row-actions"><button type="button" onClick={async () => { try { await onRestoreClient(client.id); } catch (error) { window.alert(error.message); } }}>Restore</button></div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
          </div>
        )}
      </main>
      <ClientEditorDialog isOpen={editorOpen} client={clientEditor} onSave={(values) => onSaveClient(clientEditor?.id, values)} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
