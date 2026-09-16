import { useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SupplierDetailsPage from "./pages/SupplierDetailsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientDetailsPage from "./pages/ClientDetailsPage.jsx";
import { demoSuppliers } from "./data/demoSuppliers.js";
import { demoClients } from "./data/demoClients.js";

const SESSION_KEY = "illuminux-demo-session";

function readSavedSession() {
  try {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    return savedSession ? JSON.parse(savedSession) : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(readSavedSession);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  function handleLogin(authenticatedUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setCurrentPage("dashboard");
    setSelectedSupplier(null);
    setSelectedClient(null);
  }

  function openSupplier(supplier) {
    setSelectedSupplier(supplier);
    setCurrentPage("supplier-details");
  }

  function openClient(client) {
    setSelectedClient(client);
    setCurrentPage("client-details");
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (currentPage === "suppliers") {
    return (
      <SuppliersPage
        suppliers={demoSuppliers}
        onBack={() => setCurrentPage("dashboard")}
        onSelectSupplier={openSupplier}
      />
    );
  }

  if (currentPage === "clients") {
    return (
      <ClientsPage
        clients={demoClients}
        onBack={() => setCurrentPage("dashboard")}
        onSelectClient={openClient}
      />
    );
  }

  if (currentPage === "supplier-details" && selectedSupplier) {
    return (
      <SupplierDetailsPage
        supplier={selectedSupplier}
        onBack={() => setCurrentPage("suppliers")}
      />
    );
  }

  if (currentPage === "client-details" && selectedClient) {
    return (
      <ClientDetailsPage
        client={selectedClient}
        onBack={() => setCurrentPage("clients")}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      onLogout={handleLogout}
      onOpenClients={() => setCurrentPage("clients")}
      onOpenSuppliers={() => setCurrentPage("suppliers")}
    />
  );
}
