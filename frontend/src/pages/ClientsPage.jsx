import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
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
  const [companySearch, setCompanySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isAdmin = user?.role === "admin";
  const visibleClients = clients
    .filter((client) => isAdmin || !client.deletedAt)
    .filter((client) => client.name.toLowerCase().includes(companySearch.trim().toLowerCase()))
    .filter((client) => {
      if (statusFilter === "all") return true;
      const status = client.deletedAt ? "deleted" : client.billingStatus?.toLowerCase();
      return status === statusFilter;
    });

  return (
    <div className="app-page client-page">
      <TrackRecordHeader
        title="Clients Track Records"
      />

      <main className="record-section-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
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
            <section className="client-list-card record-list-card" aria-labelledby="clientListTitle">
              <div className="company-list-filters">
                <label>
                  <span>Search company</span>
                  <input
                    type="search"
                    value={companySearch}
                    placeholder="Search client name"
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
                    <tr id="clientListTitle">
                      <th scope="col">Client name</th>
                      <th scope="col">Billing status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClients.map((client) => (
                      <tr className={client.deletedAt ? "is-deleted" : ""} key={client.id}>
                        <td>
                          <button
                            className="client-name-button"
                            type="button"
                            onClick={() => !client.deletedAt && onSelectClient(client)}
                            disabled={Boolean(client.deletedAt)}
                            aria-label={`Open ${client.name} client records`}
                          >
                            {client.name}
                          </button>
                        </td>
                        <td>
                          <div className="client-row-controls">
                            <span className={`client-status client-status--${client.billingStatus?.toLowerCase().replaceAll(" ", "-") || "not-paid"}`}>{client.deletedAt ? "Deleted" : client.billingStatus}</span>
                            {isAdmin && client.deletedAt && client.restoreAllowed !== false && <div className="row-actions"><button type="button" onClick={async () => { try { await onRestoreClient(client.id); } catch (error) { window.alert(error.message); } }}>Restore</button></div>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visibleClients.length === 0 && (
                      <tr><td className="company-list-empty" colSpan="2">No clients match the selected filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
      <ClientEditorDialog isOpen={editorOpen} client={clientEditor} onSave={(values) => onSaveClient(clientEditor?.id, values)} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
