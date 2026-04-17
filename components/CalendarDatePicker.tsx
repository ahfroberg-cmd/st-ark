// components/CalendarDatePicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;                 // ISO: "YYYY-MM-DD"
  onChange: (iso: string) => void;
  label?: string;
  minYear?: number;              // default 1990
  maxYear?: number;              // default currentYear+10
  minDate?: string;              // ISO: "YYYY-MM-DD" - minimum datum som kan väljas
  weekStartsOn?: 0 | 1;          // 0=söndag, 1=måndag (default 1)
  isClearable?: boolean;
  align?: "left" | "right";      // popover-placering, default "left"
  className?: string;            // extra klasser för trigger-knappen
  forceDirection?: "up" | "down"; // Tvinga riktning (default: auto)
  "data-info"?: string;          // Info-text för informationsvyn
};

export default function CalendarDatePicker({
  value,
  onChange,
  label,
  minYear = 1990,
  maxYear,
  minDate,
  weekStartsOn = 1,
  isClearable,
  align = "left",
  className,
  forceDirection,
  "data-info": dataInfo,
}: Props) {
  const normalized = parseISO(value) ?? todayISO();
  const init = new Date(normalized + "T00:00:00");

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth()); // 0..11
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<"down" | "up">(forceDirection || "down");
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
  
  // Använd forceDirection direkt om det är satt, annars använd direction state
  // Detta säkerställer att forceDirection alltid prioriteras omedelbart
  const effectiveDirection = forceDirection !== undefined ? forceDirection : direction;
  
  // Uppdatera direction om forceDirection ändras
  useEffect(() => {
    if (forceDirection) {
      setDirection(forceDirection);
    }
  }, [forceDirection]);

  // Dynamiskt grid: 4–6 veckor beroende på månad/offset
  const weeks = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, weekStartsOn),
    [viewYear, viewMonth, weekStartsOn]
  );
  
  // Beräkna position som fixed koordinater (undviker klippning av overflow:hidden-föräldrar)
  const computePortalStyle = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const calW = 320;
    // Alltid 6 rader × 36px + header (~90px) + weekdays (~32px) + footer (~44px) ≈ 382px
    const calH = 6 * 36 + 166;

    // Vertikal: öppna nedåt om plats finns, annars uppåt
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    let top: number;
    if (forceDirection === "up" || (effectiveDirection !== "down" && spaceBelow < calH && spaceAbove >= calH)) {
      top = Math.max(8, rect.top - calH - 4);
    } else {
      // Alltid nedåt – expandera nedanför utan maxHeight-klippning
      top = rect.bottom + 4;
      if (top + calH > vh - 8) top = Math.max(8, vh - calH - 8);
    }

    // Horisontell: justera så kalendern inte klipps
    let left = rect.left;
    if (align === "right") left = rect.right - calW;
    left = Math.max(8, Math.min(left, vw - calW - 8));

    setPortalStyle({
      position: "fixed",
      top,
      left,
      width: calW,
      zIndex: 9999,
    });
  }, [align, effectiveDirection, forceDirection]);

  // Positionera en gång när popupen öppnas — top låses då, kalendern förlängs nedåt vid fler veckorader
  useLayoutEffect(() => {
    if (!open) return;
    computePortalStyle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // avsiktligt exkludera computePortalStyle från deps för att låsa positionen vid öppning

  // Re-beräkna vid scroll/resize (stödjer scroll inuti modal)
  useEffect(() => {
    if (!open) return;
    const handler = () => computePortalStyle();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, computePortalStyle]);


  const thisYear = new Date().getFullYear();
  const upperYear = maxYear ?? thisYear + 10;

  // Esc stänger
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Stäng kalender när man klickar utanför (global hanterare)
  useEffect(() => {
    if (!open) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const path = (e.composedPath?.() ?? []) as EventTarget[];
      const hitCalendar = calendarRef.current ? path.includes(calendarRef.current) : false;
      const hitRoot = rootRef.current ? path.includes(rootRef.current) : false;

      // Fallback om composedPath saknas
      const target = e.target as HTMLElement | null;
      const containsCalendar = target ? !!calendarRef.current?.contains(target) : false;
      const containsRoot = target ? !!rootRef.current?.contains(target) : false;

      if (hitCalendar || hitRoot || containsCalendar || containsRoot) return;
      setOpen(false);
    };

    // pointerdown fungerar för mus + touch + pen och fångar även innan click
    document.addEventListener("pointerdown", handlePointerDownOutside, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
    };
  }, [open]);

  // Lokala labels
  const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(
    new Date(viewYear, viewMonth, 1)
  );

  // Veckodagar (Mån–Sön när weekStartsOn=1)
  const weekdays = useMemo(() => {
    const base: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(2024, 0, i + 1); // 1 jan 2024 = måndag
      base.push(new Intl.DateTimeFormat("sv-SE", { weekday: "short" }).format(day));
    }
    return weekStartsOn === 1 ? base : rotate(base, 1 * -1);
  }, [weekStartsOn]);

  // Vald dag (för markering)
  const isoValue = normalized;
  const [selY, selM0, selD] = [
    Number(isoValue.slice(0, 4)),
    Number(isoValue.slice(5, 7)) - 1,
    Number(isoValue.slice(8, 10)),
  ];

  function pick(year: number, month0: number, day: number) {
    const iso = fmtISO(year, month0 + 1, day);
    onChange(iso);
    setOpen(false);
  }

  function navMonth(delta: number) {
    let y = viewYear, m = viewMonth + delta;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    if (y < minYear || y > upperYear) return;
    setViewYear(y); setViewMonth(m);
  }
  function navYear(delta: number) {
    const y = clamp(viewYear + delta, minYear, upperYear);
    setViewYear(y);
  }

  // Synka vy om värdet ändras utifrån
  useEffect(() => {
    const d = new Date((parseISO(value) ?? todayISO()) + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  // Trigger-stil
  const triggerClasses =
    "w-full inline-flex h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm " +
    "transition hover:bg-slate-50 hover:border-slate-400 select-none";

  return (
    <div ref={rootRef} className="relative inline-block w-full align-top">
      {label ? <label className="mb-1 block text-sm text-slate-900">{label}</label> : null}

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className ? `${triggerClasses} ${className}` : triggerClasses}
        data-info={dataInfo}
      >

        <span className="truncate text-slate-900">{fmtHuman(isoValue)}</span>
        <span className="ml-auto opacity-70">📅</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={calendarRef}
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={portalStyle}
          className="rounded-xl border border-slate-200 bg-white shadow-2xl"
        >

            {/* Header: månad + år, med navigering */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
              <button type="button" onClick={() => navYear(-1)} className="h-7 w-7 rounded-md border border-transparent text-slate-900 hover:border-slate-300 hover:bg-white select-none" title="Föregående år">«</button>
              <button type="button" onClick={() => navMonth(-1)} className="h-7 w-7 rounded-md border border-transparent text-slate-900 hover:border-slate-300 hover:bg-white select-none" title="Föregående månad">‹</button>

              <div className="mx-1 flex items-center gap-2">
                <div className="min-w-[8ch] text-sm font-semibold capitalize">{capitalize(monthLabel)}</div>
                <select className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm select-none" value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))}>
                  {range(minYear, upperYear).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <button type="button" onClick={() => navMonth(1)} className="ml-auto h-7 w-7 rounded-md border border-transparent text-slate-900 hover:border-slate-300 hover:bg-white select-none" title="Nästa månad">›</button>
              <button type="button" onClick={() => navYear(1)} className="h-7 w-7 rounded-md border border-transparent text-slate-900 hover:border-slate-300 hover:bg-white select-none" title="Nästa år">»</button>
            </div>

            {/* Veckodagar */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 px-px py-px">
              {weekdays.map((w, i) => (
                <div key={i} className="select-none bg-white py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-900" title={w}>
                  {w.slice(0, 2)}
                </div>
              ))}
            </div>

            {/* Dagar */}
            <div className="grid gap-px bg-slate-200 px-px pb-px">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-px">
                  {week.map((cell, di) => {
                    const inMonth = cell.inMonth && typeof cell.day === "number";
                    const day = inMonth ? (cell.day as number) : null;

                    const isSelected =
                      inMonth && viewYear === selY && viewMonth === selM0 && day === selD;

                    const isToday = isTodayDate(viewYear, viewMonth, day ?? -1);

                    // Kontrollera om datumet är före minDate
                    const isBeforeMinDate = minDate && day != null
                      ? fmtISO(viewYear, viewMonth + 1, day) < minDate
                      : false;

                    return (
                      <button
                        key={di}
                        type="button"
                        disabled={!inMonth || isBeforeMinDate}
                        onPointerDown={(e) => {
                          e.preventDefault();   // ingen fokus/blur till föräldrar
                          e.stopPropagation();  // bubbla inte upp (första klicket stannar här)
                          if (!inMonth || day == null || isBeforeMinDate) return;
                          pick(viewYear, viewMonth, day);  // sätter onChange + stänger
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!inMonth || day == null || isBeforeMinDate) return;
                          pick(viewYear, viewMonth, day);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                        }}
                        className={[
                          "h-9 select-none rounded-md bg-white text-sm transition",
                          inMonth && !isBeforeMinDate ? "hover:bg-slate-50 focus:bg-slate-50" : "cursor-default opacity-40",
                          isSelected ? "ring-2 ring-sky-500" : "",
                        ].join(" ")}
                      >
                        <span className="inline-flex items-center justify-center text-slate-900">
                          <span className="tabular-nums">{inMonth ? day : ""}</span>
                          {isToday && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 align-middle" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Snabbknappar */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-2 py-1.5">
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  const t = todayISO();
                  const td = new Date(t + "T00:00:00");
                  setViewYear(td.getFullYear());
                  setViewMonth(td.getMonth());
                  onChange(t);
                  setOpen(false);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 hover:bg-slate-50 hover:border-slate-400 select-none"
              >
                Idag
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 hover:bg-slate-50 hover:border-slate-400 select-none"
              >
                Stäng
              </button>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ================= Hjälpfunktioner ================= */

function parseISO(s?: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  const maxD = new Date(y, mo, 0).getDate();
  if (d < 1 || d > maxD) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function todayISO(): string {
  const d = new Date();
  return fmtISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function fmtISO(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function fmtHuman(iso: string): string {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" }).format(dt);
}

function rotate<T>(arr: T[], shift: number): T[] {
  const a = [...arr];
  while (shift > 0) { a.unshift(a.pop() as T); shift--; }
  while (shift < 0) { a.push(a.shift() as T); shift++; }
  return a;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isTodayDate(y: number, m0: number, d: number) {
  if (d <= 0) return false;
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m0 && t.getDate() === d;
}

/** Bygg veckogrid för en månad. Returnerar ALLTID exakt 6 veckor för stabil höjd. */
function buildMonthGrid(year: number, month0: number, weekStartsOn: 0 | 1) {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const firstDay = new Date(year, month0, 1).getDay();
  let leading = (firstDay - weekStartsOn + 7) % 7;

  const weeks: Array<Array<{ day: number | null; inMonth: boolean }>> = [];
  let week: Array<{ day: number | null; inMonth: boolean }> = [];

  for (let i = 0; i < leading; i++) week.push({ day: null, inMonth: false });

  for (let d = 1; d <= daysInMonth; d++) {
    week.push({ day: d, inMonth: true });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push({ day: null, inMonth: false });
    weeks.push(week);
  }

  return weeks;
}

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
