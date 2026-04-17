"use client";

import HandledareDashboard from "@/components/HandledareDashboard";

export default function StudentHandledareTab({
  studentId,
  studentName,
  activeTab,
}: {
  studentId: string;
  studentName: string;
  activeTab: "handledning" | "suggest";
}) {
  return (
    <div className="max-h-[min(65vh,520px)] min-h-[200px] overflow-y-auto">
      <HandledareDashboard embedded selectedStUserId={studentId} activeTab={activeTab} embeddedStName={studentName} />
    </div>
  );
}
