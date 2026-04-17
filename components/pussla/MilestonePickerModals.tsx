"use client";

import DesktopMilestonePicker from "@/components/DesktopMilestonePicker";
import DesktopBtMilestonePicker from "@/components/DesktopBtMilestonePicker";

export default function MilestonePickerModals(props: {
  milestonePicker: { open: boolean; mode: "course" | "placement" | null };
  setMilestonePicker: (value: { open: boolean; mode: "course" | "placement" | null }) => void;
  btMilestonePicker: { open: boolean; mode: "course" | "placement" | null };
  setBtMilestonePicker: (value: { open: boolean; mode: "course" | "placement" | null }) => void;
  goals: any;
  profileGoalsVersion?: string;
  selectedCourse: any;
  selectedPlacement: any;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion?: string) => string[];
  setCourses: (updater: (prev: any[]) => any[]) => void;
  setActivities: (updater: (prev: any[]) => any[]) => void;
}) {
  return (
    <>
      <DesktopMilestonePicker
        open={props.milestonePicker.open}
        title={
          props.milestonePicker.mode === "course"
            ? "Välj ST-delmål för kursen"
            : "Välj ST-delmål för placeringen"
        }
        goals={props.goals}
        checked={
          new Set(
            props.sanitizeStMilestonesForGoals(
              (props.milestonePicker.mode === "course"
                ? (props.selectedCourse?.milestones || [])
                : (props.selectedPlacement?.milestones || [])) as string[],
              props.profileGoalsVersion
            )
          )
        }
        onToggle={(milestoneId) => {
          const target = props.sanitizeStMilestonesForGoals([milestoneId], props.profileGoalsVersion)[0];
          if (!target) return;
          if (props.milestonePicker.mode === "course" && props.selectedCourse) {
            const current = new Set<string>(
              props.sanitizeStMilestonesForGoals(
                ((props.selectedCourse?.milestones || []) as string[]),
                props.profileGoalsVersion
              )
            );
            if (current.has(target)) {
              current.delete(target);
            } else {
              current.add(target);
            }

            props.setCourses((prev) =>
              prev.map((course) =>
                course.id === props.selectedCourse.id
                  ? { ...course, ...(course as any), milestones: Array.from(current) }
                  : course
              )
            );
          } else if (props.milestonePicker.mode === "placement" && props.selectedPlacement) {
            const current = new Set<string>(
              props.sanitizeStMilestonesForGoals(
                ((props.selectedPlacement?.milestones || []) as string[]),
                props.profileGoalsVersion
              )
            );
            if (current.has(target)) {
              current.delete(target);
            } else {
              current.add(target);
            }

            props.setActivities((prev) =>
              prev.map((activity) =>
                activity.id === props.selectedPlacement.id
                  ? { ...activity, ...(activity as any), milestones: Array.from(current) }
                  : activity
              )
            );
          }
        }}
        onClose={() => props.setMilestonePicker({ open: false, mode: null })}
      />

      <DesktopBtMilestonePicker
        open={props.btMilestonePicker.open}
        title={
          props.btMilestonePicker.mode === "course"
            ? "Välj BT-delmål för kursen"
            : "Välj BT-delmål för placeringen"
        }
        checked={
          new Set(
            (props.btMilestonePicker.mode === "course"
              ? (props.selectedCourse?.btMilestones || [])
              : (props.selectedPlacement?.btMilestones || [])) as string[]
          )
        }
        onToggle={async (milestoneId: string) => {
          if (props.btMilestonePicker.mode === "course" && props.selectedCourse) {
            const current = new Set<string>((props.selectedCourse?.btMilestones || []) as string[]);
            current.has(milestoneId) ? current.delete(milestoneId) : current.add(milestoneId);
            const next = Array.from(current);

            props.setCourses((prev) =>
              prev.map((course) =>
                course.id === props.selectedCourse.id
                  ? ({ ...course, ...(course as any), btMilestones: next })
                  : course
              )
            );
            return;
          }

          if (props.btMilestonePicker.mode === "placement" && props.selectedPlacement) {
            const current = new Set<string>((props.selectedPlacement?.btMilestones || []) as string[]);
            current.has(milestoneId) ? current.delete(milestoneId) : current.add(milestoneId);
            const next = Array.from(current);

            props.setActivities((prev) =>
              prev.map((activity) =>
                activity.id === props.selectedPlacement.id
                  ? ({ ...activity, ...(activity as any), btMilestones: next })
                  : activity
              )
            );
          }
        }}
        onClose={() => props.setBtMilestonePicker({ open: false, mode: null })}
      />
    </>
  );
}
