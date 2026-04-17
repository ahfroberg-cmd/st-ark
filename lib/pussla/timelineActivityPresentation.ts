import type { CSSProperties } from "react";

type ActivityLike = {
  type: string;
  label?: string | null;
  hue?: number | null;
};

function isLeaveType(type: string): boolean {
  return type === "Föräldraledighet" || type === "Sjukfrånvaro" || type === "Annan ledighet";
}

export function getTimelineActivityLabel(activity: ActivityLike): string {
  if (
    activity.type === "Klinisk tjänstgöring" ||
    activity.type === "Auskultation" ||
    activity.type === "Annan ledighet"
  ) {
    return activity.label || activity.type;
  }
  return activity.type;
}

export function getTimelineActivityStyle(activity: ActivityLike, selected: boolean): CSSProperties {
  if (activity.type === "Forskning") {
    return selected
      ? {
          backgroundColor: "#ffffff",
          border: "1.5px solid hsl(220 15% 55%)",
        }
      : {
          backgroundColor: "#ffffff",
          border: "1.5px solid hsl(220 14% 80%)",
        };
  }

  if (isLeaveType(activity.type)) {
    return {
      background:
        "repeating-linear-gradient(135deg, hsl(220 16% 98%), hsl(220 16% 98%) 6px, hsl(220 14% 86%) 6px, hsl(220 14% 86%) 8px)",
      border: "1px solid hsl(220 12% 60%)",
    };
  }

  const hue = Number(activity.hue ?? 220);
  return selected
    ? {
        backgroundColor: `hsl(${hue} 38% 82%)`,
      }
    : {
        backgroundColor: `hsl(${hue} 28% 88%)`,
        border: `1.5px solid hsl(${hue} 35% 50%)`,
      };
}

export function getTimelineActivityClassName(type: string, selected: boolean): string {
  const selectedNonLeave = selected && !isLeaveType(type);
  return [
    "relative pointer-events-auto h-7 select-none rounded-lg px-2 text-[11px] shadow border transition overflow-hidden",
    "cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-[1px]",
    selectedNonLeave
      ? "z-[80] ring-2 ring-sky-600 border-2 border-sky-600 text-slate-900"
      : "z-[65] border-slate-200",
  ].join(" ");
}
