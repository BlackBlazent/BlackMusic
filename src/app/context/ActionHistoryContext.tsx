import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * The spec's "left/right arrows" aren't browser back/forward — they redo/undo
 * *playback actions* ("if I played the next track, that action can be redone/undone").
 *
 * This is a small command-pattern stack: every reversible playback action (play track,
 * skip next, toggle shuffle, …) pushes a command with a `do`/`undo` pair. Playground,
 * Local, and Online all push into the same stack via `usePushAction`, so the arrows
 * work globally no matter which page triggered the action.
 */
export interface HistoryAction {
  /** Short label for debugging / a future "recently undone" tooltip. */
  label: string;
  do: () => void;
  undo: () => void;
}

interface ActionHistoryContextValue {
  canUndo: boolean;
  canRedo: boolean;
  pushAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
}

const ActionHistoryContext = createContext<ActionHistoryContextValue | null>(null);

export function ActionHistoryProvider({ children }: { children: ReactNode }) {
  const past = useRef<HistoryAction[]>([]);
  const future = useRef<HistoryAction[]>([]);
  // Only used to force a re-render when the stacks change — the arrays themselves
  // live in refs so pushing an action doesn't reset unrelated component state.
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);

  const pushAction = useCallback((action: HistoryAction) => {
    past.current.push(action);
    future.current = [];
    bump();
  }, []);

  const undo = useCallback(() => {
    const action = past.current.pop();
    if (!action) return;
    action.undo();
    future.current.push(action);
    bump();
  }, []);

  const redo = useCallback(() => {
    const action = future.current.pop();
    if (!action) return;
    action.do();
    past.current.push(action);
    bump();
  }, []);

  const value = useMemo<ActionHistoryContextValue>(
    () => ({
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      pushAction,
      undo,
      redo,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs intentionally excluded; bump() drives updates
    [pushAction, undo, redo, past.current.length, future.current.length],
  );

  return <ActionHistoryContext.Provider value={value}>{children}</ActionHistoryContext.Provider>;
}

export function useActionHistory(): ActionHistoryContextValue {
  const ctx = useContext(ActionHistoryContext);
  if (!ctx) throw new Error("useActionHistory must be used within an ActionHistoryProvider");
  return ctx;
}
