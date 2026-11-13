import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { useNotifications } from "@/app/context/NotificationsContext";
import "./ErrorScreens.css";

/**
 * IMP-02 — no blank screens, ever. If a page throws while rendering, the person sees what happened and has two ways out
 * (go home, or reload) instead of an empty window. The technical detail is available but not shoved in their face.
 */
function Problem({ title, detail, onHome, onReload }: { title: string; detail?: string; onHome?: () => void; onReload: () => void }) {
  return (
    <div className="problem" role="alert">
      <h1>{title}</h1>
      <p>Your music and settings are safe. You can go back or reload BlackMusic.</p>
      <div className="problem__actions">
        {onHome && <button type="button" onClick={onHome}>Go to Home</button>}
        <button type="button" className="problem__primary" onClick={onReload}>Reload</button>
      </div>
      {detail && <details><summary>Technical details</summary><pre>{detail}</pre></details>}
    </div>
  );
}

/** Route-level: a single page failing doesn't take the app shell down. */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  return <Problem title="This page hit a problem" detail={detail} onHome={() => navigate("/")} onReload={() => window.location.reload()} />;
}

/** App-level safety net around everything (including the providers). */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("BlackMusic crashed:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <Problem title="BlackMusic ran into a problem" detail={this.state.error.message} onReload={() => window.location.reload()} />;
  }
}

/** Failures that happen outside React (a rejected promise nobody awaited) used to vanish silently. Now they surface as a message. */
export function GlobalErrorWatcher() {
  const { push } = useNotifications();
  const last = useRef(0);
  useEffect(() => {
    const report = (why: unknown) => {
      const msg = why instanceof Error ? why.message : typeof why === "string" ? why : "";
      if (!msg || /abort|cancel|ResizeObserver loop/i.test(msg)) return; // cancelled work and a harmless browser notice aren't problems
      const now = Date.now();
      if (now - last.current < 6000) return; // never a flood
      last.current = now;
      push("Something didn't work", msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
    };
    const onRejection = (e: PromiseRejectionEvent) => report(e.reason);
    const onError = (e: ErrorEvent) => report(e.error ?? e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => { window.removeEventListener("unhandledrejection", onRejection); window.removeEventListener("error", onError); };
  }, [push]);
  return null;
}
