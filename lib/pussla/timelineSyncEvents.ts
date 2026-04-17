type PendingScanSelection = {
  kind: "placement" | "course";
  dbId: string | number;
};

type RegisterOptions = {
  onReload: () => void | Promise<void>;
  onSetPendingSelection: (selection: PendingScanSelection) => void;
};

export function registerTimelineSyncEvents(options: RegisterOptions): () => void {
  const { onReload, onSetPendingSelection } = options;

  function onStorage(ev: StorageEvent) {
    if (ev.key === "timeline_sync") {
      void onReload();
    }
  }

  function onTimelineSync() {
    void onReload();
  }

  function onProfileSaved() {
    void onReload();
  }

  function onTimelineSelectFromScan(ev: Event) {
    try {
      const ce = ev as CustomEvent<any>;
      const detail = ce.detail || {};
      if (
        detail &&
        (detail.kind === "placement" || detail.kind === "course") &&
        detail.dbId !== undefined &&
        detail.dbId !== null
      ) {
        onSetPendingSelection({
          kind: detail.kind,
          dbId: detail.dbId,
        });
        void onReload();
      }
    } catch {
      // ignore malformed custom events
    }
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener("timeline_sync", onTimelineSync as EventListener);
  window.addEventListener("profile_saved", onProfileSaved as EventListener);
  window.addEventListener("timeline_select_from_scan", onTimelineSelectFromScan as EventListener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("timeline_sync", onTimelineSync as EventListener);
    window.removeEventListener("profile_saved", onProfileSaved as EventListener);
    window.removeEventListener("timeline_select_from_scan", onTimelineSelectFromScan as EventListener);
  };
}
