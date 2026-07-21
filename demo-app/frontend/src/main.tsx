import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAccessibilityPreferences } from "./components/AccessibilityMenu";
import "./index.css";

// Aplică preferințele salvate (mărime text/contrast) înainte de primul randare, ca
// să nu existe un "flash" de aspect implicit înainte de a se aplica setarea salvată.
initAccessibilityPreferences();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
