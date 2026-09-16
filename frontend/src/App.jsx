import { useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SupplierDetailsPage from "./pages/SupplierDetailsPage.jsx";
import { demoSuppliers } from "./data/demoSuppliers.js";

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

  function handleLogin(authenticatedUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setCurrentPage("dashboard");
    setSelectedSupplier(null);
  }

  function openSupplier(supplier) {
    setSelectedSupplier(supplier);
    setCurrentPage("supplier-details");
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

  if (currentPage === "supplier-details" && selectedSupplier) {
    return (
      <SupplierDetailsPage
        supplier={selectedSupplier}
        onBack={() => setCurrentPage("suppliers")}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      onLogout={handleLogout}
      onOpenSuppliers={() => setCurrentPage("suppliers")}
    />
  );
}
