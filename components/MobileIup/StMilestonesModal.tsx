// components/MobileIup/StMilestonesModal.tsx
"use client";

import React from "react";
import MobileMilestoneOverviewPanel from "@/components/MobileIup/MobileMilestoneOverviewPanel";

type Props = {
  open: boolean;
  onClose: () => void;
  goalsVersion?: "2015" | "2021";
};

export default function StMilestonesModal({ open, onClose, goalsVersion }: Props) {
  const title = goalsVersion === "2015" ? "Delmål" : "ST-delmål";
  const [mountKey, setMountKey] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Force remount when opening with new timestamp
      setMountKey(Date.now());
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
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[980px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <MobileMilestoneOverviewPanel
          key={`st-only-${mountKey}`}
          open={true}
          initialTab="st"
          onClose={onClose}
          title={title}
        />
      </div>
    </div>
  );
}

