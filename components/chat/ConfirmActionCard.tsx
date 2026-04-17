"use client";

import React from "react";
import type { PusslaAgentAction } from "@/lib/ai/types";
import { actionLabel } from "@/lib/ai/actionPolicy";

export default function ConfirmActionCard(props: {
  action: PusslaAgentAction;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { action, onConfirm, onCancel, busy } = props;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
      <p className="font-semibold text-amber-900">Bekräftelse krävs</p>
      <p className="mt-1">{actionLabel(action)}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Kör..." : "Bekräfta"}
        </button>
      </div>
    </div>
  );
}
