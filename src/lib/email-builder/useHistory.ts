import { useCallback, useEffect, useRef, useState } from "react";

const MAX = 80;

export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, force] = useState(0);

  const set = useCallback((updater: T | ((prev: T) => T), opts?: { history?: boolean }) => {
    setPresent((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      if (opts?.history !== false && next !== prev) {
        past.current.push(prev);
        if (past.current.length > MAX) past.current.shift();
        future.current = [];
        force((n) => n + 1);
      }
      return next;
    });
  }, []);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    setPresent(v);
    force((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    setPresent((prev) => {
      const last = past.current.pop();
      if (last === undefined) return prev;
      future.current.push(prev);
      force((n) => n + 1);
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setPresent((prev) => {
      const next = future.current.pop();
      if (next === undefined) return prev;
      past.current.push(prev);
      force((n) => n + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Allow native undo/redo inside text inputs / textareas / contenteditable
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === "y") || (key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return {
    state: present,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
