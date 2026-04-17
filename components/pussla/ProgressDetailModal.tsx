"use client";

import ProgressMilestoneDetailSection from "@/components/pussla/ProgressMilestoneDetailSection";
import ProgressTimeDetailSection from "@/components/pussla/ProgressTimeDetailSection";

type ProgressDetailOpen = "time" | "milestones" | null;

export default function ProgressDetailModal(props: {
  open: ProgressDetailOpen;
  is2021: boolean;
  onClose: () => void;
  timeDetails: any;
  timeByActivity: any;
  hoveredTimeAct: any;
  createProgressHoverEnterHandler: any;
  clearProgressHover: () => void;
  milestoneDetails: any;
  onOpenMilestonesPage: () => void;
}) {
  const {
    open,
    is2021,
    onClose,
    timeDetails,
    timeByActivity,
    hoveredTimeAct,
    createProgressHoverEnterHandler,
    clearProgressHover,
    milestoneDetails,
    onOpenMilestonesPage,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="m-0 text-lg font-extrabold text-slate-900">
              {open === "time" ? "Genomförd tid" : "Delmålsuppfyllelse"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </header>

          <div className="p-6">
            {open === "time" ? (
              <ProgressTimeDetailSection
                is2021={is2021}
                timeDetails={timeDetails}
                timeByActivity={timeByActivity}
                hoveredTimeAct={hoveredTimeAct}
                createProgressHoverEnterHandler={createProgressHoverEnterHandler}
                clearProgressHover={clearProgressHover}
              />
            ) : (
              <ProgressMilestoneDetailSection
                is2021={is2021}
                milestoneDetails={milestoneDetails}
                onOpenMilestonesPage={onOpenMilestonesPage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
