// components/LegacyMilestoneDetail.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { GoalsMilestone } from "@/lib/goals";

type Props = {
  open: boolean;
  milestone: GoalsMilestone | null;
  onClose: () => void;
  selectable?: boolean;
  checked?: boolean;
  onToggle?: (milestoneId: string) => void;
};

export default function LegacyMilestoneDetail({
  open,
  milestone,
  onClose,
  selectable = false,
  checked = false,
  onToggle,
}: Props) {
  if (!open || !milestone) return null;
  const m = milestone;

  const toText = (v: unknown) =>
    typeof v === "string"
      ? v
      : v == null
      ? ""
      : Array.isArray(v)
      ? v.join("\n")
      : String(v);

  const sections = [
    { key: "kompetenskrav",        title: "Kompetenskrav",        text: toText(m.sections?.kompetenskrav) },
    { key: "utbildningsaktiviteter", title: "Utbildningsaktiviteter", text: toText(m.sections?.utbildningsaktiviteter) },
    { key: "intyg",                title: "Intyg",                text: toText(m.sections?.intyg) },
    { key: "allmannaRad",          title: "Allmänna råd",         text: toText(m.sections?.allmannaRad) },
  ] as const;

  const visible = sections.filter(s => s.text.trim().length > 0);

  return (
    <div style={overlay} onClick={(e)=>{ if (e.target===e.currentTarget) onClose(); }}>
      <div style={modal} onClick={(e)=>e.stopPropagation()}>
        <header style={hdr}>
          <div style={{ fontWeight:700, fontSize:16 }}>
            {m.code} – {m.title}
          </div>
          {selectable && onToggle ? (
            <button
              onClick={() => {
                onToggle(m.id);
                onClose();
              }}
              style={{
                padding: "8px 16px",
                border: "1px solid",
                borderRadius: 10,
                background: checked ? "#ef4444" : "#10b981",
                borderColor: checked ? "#ef4444" : "#10b981",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Spara och stäng
            </button>
          ) : (
            <button onClick={onClose} style={btnX} aria-label="Stäng">×</button>
          )}
        </header>

        <div style={{ padding:14, maxHeight:"70vh", overflow:"auto" }}>
          {visible.length === 0 ? (
            <div style={infoBox}>Ingen beskrivning hittades i målfilen.</div>
          ) : (
            <div style={grid2x2}>
              {visible.map((s) => (
                <article key={s.key} style={card}>
                  <div style={cardTitle}>{s.title}</div>
                  <pre style={pre}>{s.text}</pre>
                </article>
              ))}
            </div>
          )}

          {m.sourceUrl && (
            <div style={{ fontSize:12, marginTop:10 }}>
              Källa:{" "}
              <a href={m.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration:"underline" }}>
                målbeskrivningen
              </a>
            </div>
          )}
        </div>

        <footer style={ftr}>
          {!selectable && (
            <>
              <div style={{ marginLeft:"auto" }} />
              <button onClick={onClose} style={btn}>Stäng</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ---- styles ---- */
const overlay: React.CSSProperties = {
  position:"fixed", inset:0, background:"rgba(0,0,0,.32)",
  display:"grid", placeItems:"center", padding:16, zIndex:60
};
const modal: React.CSSProperties = {
  background:"#fff", borderRadius:12, width:"100%", maxWidth:860, overflow:"hidden",
  boxShadow:"0 12px 36px rgba(0,0,0,.28)"
};
const hdr: React.CSSProperties = {
  display:"flex", alignItems:"center", justifyContent:"space-between",
  padding:"10px 12px", borderBottom:"1px solid #e5e7eb"
};
const ftr: React.CSSProperties = {
  display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
  borderTop:"1px solid #e5e7eb"
};
const btn: React.CSSProperties = {
  padding:"8px 12px", border:"1px solid #d0d7de", borderRadius:10, background:"#fff"
};
const btnPrimary: React.CSSProperties = {
  ...btn, background:"#10b981", borderColor:"#10b981", color:"#fff", fontWeight:600
};
const btnDanger: React.CSSProperties = {
  ...btn, background:"#ef4444", borderColor:"#ef4444", color:"#fff", fontWeight:600
};
const btnX: React.CSSProperties = {
  ...btn, width:36, height:36, lineHeight:"20px", textAlign:"center", padding:0
};
const infoBox: React.CSSProperties = {
  padding:10, border:"1px solid #e5e7eb", borderRadius:10, background:"#fafafa", color:"#374151"
};
const grid2x2: React.CSSProperties = {
  display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:12
};
const card: React.CSSProperties = {
  border:"1px solid #e5e7eb", borderRadius:12, padding:10, background:"#fff"
};
const cardTitle: React.CSSProperties = {
  fontWeight:700, marginBottom:6
};
const pre: React.CSSProperties = {
  whiteSpace:"pre-wrap",
  fontFamily:"ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  fontSize:14, color:"#111827"
};
