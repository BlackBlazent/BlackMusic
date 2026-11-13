import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/interactive.css";
import "./styles/mobile.css";
import { isPipWindow } from "@/lib/pip/pipBridge";
import { installMobileLock } from "@/lib/mobileLock";
import { AppErrorBoundary } from "@/app/components/ErrorScreens";

if (!isPipWindow()) installMobileLock();

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
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>,
    ),
  ).catch((e: unknown) => {
    // the app bundle itself failed to load: say so instead of showing an empty window
    root.render(<div style={{ padding: 24, color: "#abb2bf", fontFamily: "system-ui, sans-serif" }}><h1>BlackMusic couldn't start</h1><p>{e instanceof Error ? e.message : String(e)}</p><button onClick={() => location.reload()}>Reload</button></div>);
  });
}