"use client";

import TimelineMonthHeader from "@/components/pussla/TimelineMonthHeader";

export default function PusslaTimelineGridAndLegend(props: {
  monthNames: string[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  closeDetailPanel: () => void;
  visibleYearCount: number;
  renderYearRow: (yearIndex: number) => React.ReactNode;
  profile: any;
  startLineColor: string;
  midLineColor: string;
  endLineColor: string;
  todayLineColor: string;
  showSupervisionOnTimeline: boolean;
  showDirectorMeetingsOnTimeline: boolean;
  showAssessmentsOnTimeline: boolean;
  showSpecialistCollegiumsOnTimeline: boolean;
}) {
  return (
    <>
      <div className="relative rounded-xl">
        <div className="relative z-10">
          <div className="mb-1">
            <TimelineMonthHeader
              monthNames={props.monthNames}
              hasSelection={Boolean(props.selectedPlacementId || props.selectedCourseId)}
              onCloseSelection={props.closeDetailPanel}
            />
          </div>
          <div className="space-y-0">{Array.from({ length: props.visibleYearCount }, (_, i) => props.renderYearRow(i))}</div>
        </div>
      </div>

      <div className="grid grid-cols-[80px_1fr] items-start mb-4">
        <div className="pr-2 text-right select-none" />
        <div className="mt-2 ml-[10px] flex flex-wrap items-center gap-4 text-xs text-slate-700">
          {(() => {
            const goals = String((props.profile as any)?.goalsVersion || "").trim();
            const is2021Goals = goals === "2021";
            if (is2021Goals) {
              return (
                <>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.startLineColor }} />
                    <span>= BT start</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.midLineColor }} />
                    <span>= BT slut</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.endLineColor }} />
                    <span>= ST slut</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.todayLineColor }} />
                    <span>= Idag</span>
                  </div>
                </>
              );
            }
            return (
              <>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.startLineColor }} />
                  <span>= ST start</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.endLineColor }} />
                  <span>= ST slut</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.todayLineColor }} />
                  <span>= Idag</span>
                </div>
              </>
            );
          })()}

          <div className="w-20" />

          {props.showSupervisionOnTimeline && (
            <div className="flex items-center gap-1">
              <span>= Huvudhandledare</span>
            </div>
          )}
          {props.showDirectorMeetingsOnTimeline && (
            <div className="flex items-center gap-1">
              <span>= Studierektor</span>
            </div>
          )}
          {props.showAssessmentsOnTimeline && (
            <div className="flex items-center gap-1">
              <span>= Progressionsbedömning</span>
            </div>
          )}
          {props.showSpecialistCollegiumsOnTimeline && (
            <div className="flex items-center gap-1">
              <span>= Specialistkollegium</span>
            </div>
          )}
        </div>
        <div />
      </div>
    </>
  );
}
