import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";
import "./styles/global.css";
import "./styles/login.css";
import "./styles/dashboard.css";
import "./styles/suppliers.css";
import "./styles/clients.css";
import "./styles/financial-records.css";
import "./styles/record-management.css";
import "./styles/vouchers.css";
import "./styles/total-sales.css";
import "./styles/outside-services.css";
import "./styles/record-tabs.css";
import "./styles/borders.css";
import "./styles/soft-theme.css";
import "./styles/admin-users.css";

const savedTheme = localStorage.getItem("illuminux-color-theme");
const initialTheme = savedTheme === "light" || savedTheme === "dark"
  ? savedTheme
  : window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.colorScheme = initialTheme;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
