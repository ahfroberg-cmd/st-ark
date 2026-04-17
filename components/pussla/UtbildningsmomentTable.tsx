"use client";

import { useState } from "react";

type CourseRow = {
  id: string;
  courseLeaderName?: string;
  startDate?: string;
  endDate?: string;
  certificateDate?: string;
};

type GroupItem = {
  title: string;
  items: CourseRow[];
};

type Props = {
  groups: GroupItem[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string) => boolean;
};

export default function UtbildningsmomentTable({ groups, selectedCourseId, onSelectCourse }: Props) {
  const [popup, setPopup] = useState<GroupItem | null>(null);
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="rounded-xl border bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-left hover:bg-emerald-100"
        >
          <div className="font-semibold text-emerald-800">Utbildningsmoment</div>
          <span className="text-emerald-700">{open ? "▾" : "▸"}</span>
        </button>
        {open && <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-sm select-none">
            <thead className="sticky top-0 bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Utbildningsmoment</th>
                <th className="px-3 py-2">Handledare</th>
                <th className="px-3 py-2 text-center">Startdatum</th>
                <th className="px-3 py-2 text-center">Slutdatum</th>
                <th className="px-3 py-2 text-center">Antal</th>
              </tr>
            </thead>
            <tbody className="cursor-default">
              {groups.map(({ title, items }) => {
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                const startDate = firstItem?.startDate || firstItem?.certificateDate || "";
                const endDate = lastItem?.endDate || lastItem?.startDate || lastItem?.certificateDate || "";
                const handledare = firstItem?.courseLeaderName || "";
                const isSelected = items.some((c) => c.id === selectedCourseId);
                return (
                  <tr
                    key={title}
                    className={`border-t cursor-pointer ${
                      isSelected ? "bg-slate-200 hover:bg-slate-300 ring-1 ring-slate-300" : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      if (items.length > 1) {
                        setPopup({ title, items });
                      } else if (firstItem) {
                        onSelectCourse(firstItem.id);
                      }
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[12px] leading-5 text-emerald-900"
                        style={{
                          backgroundColor: "hsl(152 40% 88%)",
                          border: "1px solid hsl(152 40% 72%)",
                        }}
                      >
                        {title}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-700">{handledare || "—"}</td>
                    <td className="px-3 py-1.5 text-center">{startDate || "—"}</td>
                    <td className="px-3 py-1.5 text-center">{endDate || "—"}</td>
                    <td className="px-3 py-1.5 text-center">{items.length}</td>
                  </tr>
                );
              })}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">
                    Inga utbildningsmoment. Håll Cmd/Ctrl och klicka i kursspåret för att lägga till.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
      </div>

      {popup && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">{popup.title}</h3>
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-600 font-medium">Handledare</th>
                    <th className="px-3 py-2 text-center text-slate-600 font-medium">Start</th>
                    <th className="px-3 py-2 text-center text-slate-600 font-medium">Slut</th>
                  </tr>
                </thead>
                <tbody>
                  {popup.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        const accepted = onSelectCourse(item.id);
                        if (accepted) setPopup(null);
                      }}
                    >
                      <td className="px-3 py-2 text-slate-700">{item.courseLeaderName || "—"}</td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        {item.startDate || item.certificateDate || "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        {item.endDate || item.certificateDate || item.startDate || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
