import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";
import "./styles/login.css";
import "./styles/dashboard.css";
import "./styles/suppliers.css";
import "./styles/clients.css";
import "./styles/financial-records.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
