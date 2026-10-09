import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/interactive.css";
import { isPipWindow } from "@/lib/pip/pipBridge";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

if (isPipWindow()) {
  void import("./pip/PipApp").then(({ PipApp }) =>
    root.render(
      <React.StrictMode>
        <PipApp />
      </React.StrictMode>,
    ),
  );
} else {
  void import("./App").then(({ App }) =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  );
}