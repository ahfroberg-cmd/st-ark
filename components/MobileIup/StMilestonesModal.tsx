// components/MobileIup/StMilestonesModal.tsx
"use client";

import React from "react";
import MilestoneOverviewPanel from "@/components/MilestoneOverviewModal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function StMilestonesModal({ open, onClose }: Props) {
  const [mountKey, setMountKey] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Force remount when opening
      setMountKey(prev => prev + 1);
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
        <MilestoneOverviewPanel
          key={`st-milestones-${mountKey}`}
          open={true}
          initialTab="st"
          onClose={onClose}
        />
      </div>
    </div>
  );
}

