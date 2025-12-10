// components/MobileIup/MeetingsPopup.tsx
"use client";

import React, { useRef } from "react";
import type { IupMeeting } from "@/components/IupModal";
import MeetingsView from "./MeetingsView";

type Props = {
  open: boolean;
  meetings: IupMeeting[];
  editingId: string | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onUpdate: (meeting: IupMeeting) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

export default function MeetingsPopup({
  open,
  meetings,
  editingId,
  onAdd,
  onEdit,
  onUpdate,
  onRemove,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-sky-900">Handledarsamtal</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-px"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <MeetingsView
            meetings={meetings}
            editingId={editingId}
            onAdd={onAdd}
            onEdit={onEdit}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onCloseEdit={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

