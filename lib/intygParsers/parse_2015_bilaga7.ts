// lib/intygParsers/parse_2015_bilaga7.ts
import type { IntygKind } from "@/lib/intygDetect";
import type { OcrWord } from "@/lib/ocr";

// Minimal layout-typ (matchar Tesseract.js result.data.blocks)
type OcrBBox = { x0: number; y0: number; x1: number; y1: number };
type OcrBlock = { bbox: OcrBBox; text: string };
type OcrLayout = { blocks: OcrBlock[] } | null;

type Parsed = {
  kind?: IntygKind;
  fullName?: string;
  personnummer?: string;
  specialtyHeader?: string;
  delmalCodes?: string[];
  clinic?: string;          // ÄMNE (rubrik)
  description?: string;     // Beskrivning av arbetet
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
};

function asciiSoft(s: string) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}
function normalize(s: string) { return (s || "").replace(/\r\n?/g, "\n"); }
function firstWordOnly(s?: string) { if (!s) return s; const m = s.trim().match(/^[A-Za-zÅÄÖåäö\-]+/); return m ? m[0] : s.trim(); }
function tidyOneLine(s: string) {
  return (s || "")
    .replace(/\s+\|/g, " ").replace(/[|]/g, " ").replace(/\s+/g, " ")
    .replace(/^[,.:;\-–—]+/, "").trim();
}
function enforceBulletBreaks(s: string) {
  if (!s) return s;
  let out = s.replace(/\r\n?/g, "\n");
  out = out.replace(/[ \t]+\n/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.split("\n").map(line => line.replace(/[ \t]+$/g, "")).join("\n");
  return out.trim();
}

function blockText(layout: OcrLayout, headingRe: RegExp): string | null {
  if (!layout?.blocks?.length) return null;
  // 1) hitta block vars text innehåller rubriken
  const idx = layout.blocks.findIndex(b => headingRe.test(asciiSoft(b.text)));
  if (idx < 0) return null;

  // 2) ta själva blocket ELLER närmaste blocket precis under (för formulär där rubriken är egen rad)
  const anchor = layout.blocks[idx];
  const anchorY = anchor.bbox.y0;
  const sameBoxText = asciiSoft(anchor.text).replace(headingRe, "").trim();

  // Om rubrikblocket i sig innehåller annan text, använd den (efter rubriken)
  if (sameBoxText && sameBoxText.length >= 2) {
    return tidyOneLine(anchor.text.replace(/^[=\-—:\s]+/gm, "")).trim();
  }

  // Annars: plocka texten från "närmsta block under" inom rimlig X-overlapp
  const ax0 = anchor.bbox.x0, ax1 = anchor.bbox.x1;
  const under = layout.blocks
    .filter(b => b.bbox.y0 > anchorY && overlapX(b.bbox, anchor.bbox) > 0.35)
    .sort((a,b) => a.bbox.y0 - b.bbox.y0)[0];

  if (under) {
    return tidyOneLine(under.text.replace(/^[=\-—:\s]+/gm, ""));
  }
  return null;
}

function overlapX(a: OcrBBox, b: OcrBBox) {
  const left = Math.max(a.x0, b.x0);
  const right = Math.min(a.x1, b.x1);
  const w = Math.max(0, right - left);
  const aw = Math.max(1, a.x1 - a.x0);
  const bw = Math.max(1, b.x1 - b.x0);
  return Math.max(w / aw, w / bw);
}

function sliceBetweenBlocks(layout: OcrLayout, startRe: RegExp, endRe: RegExp): string | null {
  if (!layout?.blocks?.length) return null;
  const idxStart = layout.blocks.findIndex(b => startRe.test(asciiSoft(b.text)));
  if (idxStart < 0) return null;

  // hitta första block under start som ser ut som innehåll (inte rubrik/rad med bara rubriken)
  const startBox = layout.blocks[idxStart];
  const ax0 = startBox.bbox.x0, ax1 = startBox.bbox.x1, ay0 = startBox.bbox.y0;
  // slut-anker (nästa rubrik/sektion)
  const idxEnd = layout.blocks.findIndex((b, i) => i > idxStart && endRe.test(asciiSoft(b.text)));
  const endY = idxEnd >= 0 ? layout.blocks[idxEnd].bbox.y0 : Infinity;

  // samla alla block mellan start och slut som rimligen ligger "i samma spalt"
  const bodyBlocks = layout.blocks.filter(b =>
    b.bbox.y0 > ay0 && b.bbox.y1 < endY && overlapX(b.bbox, startBox.bbox) > 0.35
  );

  if (!bodyBlocks.length) return null;
  const merged = bodyBlocks.map(b => b.text).join("\n");
  return merged
    .replace(/^[=\-—:\s]+/gm, "")
    .split(/\r?\n/)
    .map(tidyOneLine)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractDelmalCodes(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .replace(/\b([abc])\s*([0-9])\s*[.\s]\s*([0-9])\b/gi, (_m, g1, d1, d2) => `${g1}${d1}${d2}`)
    .replace(/\s+/g, " ");
  const out = new Set<string>();
  const re = /\b(?:st[\s-]*)?([abc])[\s-]*([0-9]{1,2})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const letter = (m[1] || "").toLowerCase();
    const num = (m[2] || "").replace(/^0+/, "") || "0";
    const hadST = /^st/i.test(normalized.slice(Math.max(0, m.index - 3), m.index + 1));
    out.add(hadST ? `ST${letter}${num}` : `${letter}${num}`);
  }
  return Array.from(out);
}

// Acceptera både layout (gammalt) och words (nytt) för bakåtkompatibilitet
export function parse_2015_bilaga7(rawInput: string, layoutOrWords?: OcrLayout | OcrWord[]): Parsed {
  // Om det är en array av OcrWord, ignorera det för nu (denna parser använder layout)
  const layout = Array.isArray(layoutOrWords) ? undefined : (layoutOrWords as OcrLayout | undefined);
  const raw = normalize(rawInput);
  const soft = asciiSoft(raw);
  const out: Parsed = { kind: "2015-B7-SKRIFTLIGT" };

  // 0) Försök primärt layout-baserat (ruta) — annars fallback regex
  // NAMN
  {
    const ef = blockText(layout ?? null, /\befternamn\b/i);
    const fo = blockText(layout ?? null, /\bförnamn\b/i);
    const last = ef ? tidyOneLine(ef) : (raw.match(/\b[Ee]fternamn\s*[:\-]?\s*([^\n|]+)/)?.[1] ?? "");
    const first = fo ? tidyOneLine(fo) : (raw.match(/\b[fF][öo]rnamn\s*[:\-]?\s*([^\n|]+)/)?.[1] ?? "");
    const full = [last, first].filter(Boolean).join(" ").trim()
      .replace(/\b(förnamn|efternamn)\b/gi, "").replace(/\s{2,}/g, " ").trim();
    if (full) out.fullName = full;
  }

  // PERSONNUMMER
  {
    const pnBlock = blockText(layout ?? null, /\bpersonnummer\b/i);
    const pn = (pnBlock || raw).match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/);
    if (pn?.[0]) out.personnummer = pn[0];
  }

  // SPECIALITET (första ord)
  {
    const sp = blockText(layout ?? null, /specialitet\s+som\s+ans[öo]kan\s+avser/i);
    const m = (sp || raw).match(/specialitet\s+som\s+ans[öo]kan\s+avser\s*[:\-]?\s*([^\n|]+)/i);
    if (m?.[1]) out.specialtyHeader = firstWordOnly(tidyOneLine(m[1]));
  }

  // DELMÅL — Begränsa till rutan under "Delmål som intyget avser"
  {
    const box = sliceBetweenBlocks(
      layout ?? null,
      /(delm[aå]l\s+som\s+intyget\s+avser|delm[aå]l)/i,
      /(ämne\s+för\s+självständigt\s+skriftligt\s+arbete|amne\s+for|beskrivning|handledare|intygande|underskrift)/i
    ) || null;

    const src = box || (
      // text-fallback
      (() => {
        const s = soft.search(/(delm[aå]l\s+som\s+intyget\s+avser|delm[aå]l)/i);
        if (s < 0) return "";
        const tail = soft.slice(s);
        const e = tail.search(/(ämne|amne|beskrivning|handledare|intygande|underskrift)/i);
        const startIdx = s;
        const endIdx = e < 0 ? soft.length : s + e;
        return raw.slice(mapBack(raw, soft, startIdx), mapBack(raw, soft, endIdx));
      })()
    );

    const codes = extractDelmalCodes(src);
    if (codes.length) out.delmalCodes = codes;
  }

  // ÄMNE (rubrik) — Begränsa till rutan under "Ämne för självständigt..."
  {
    const amneBox = blockText(layout ?? null, /ämne\s+för\s+självständigt\s+skriftligt\s+arbete/i) ||
      sliceBetweenBlocks(layout ?? null,
        /ämne\s+för\s+självständigt\s+skriftligt\s+arbete/i,
        /(beskrivning|handledare|intygande|underskrift)/i
      );
    let amne = amneBox ?? raw.match(/^\s*Ämne\s+för\s+självständigt\s+skriftligt\s+arbete[^\n]*?:\s*([^\n]+)$/im)?.[1] ?? "";
    if (!amne && amneBox) amne = amneBox.split("\n")[0] ?? "";
    if (amne) {
      const cleaned = tidyOneLine(amne)
        .replace(/\b\d{4}[.\-\/ ]\d{2}[.\-\/ ]\d{2}\b/g, " ")
        .replace(/\s{2,}/g, " ").trim();
      if (cleaned) out.clinic = cleaned;
    }
  }

  // BESKRIVNING — Begränsa till rutan under "Beskrivning av det självständiga..."
  {
    const desc = sliceBetweenBlocks(
      layout ?? null,
      /beskrivning\s+av\s+det\s+sj[aä]lvst[aä]ndiga\s+skriftliga\s+arbetet/i,
      /(handledare|intygande|underskrift|namnförtydligande|namnfortydligande|specialitet\s+som\s+ans[öo]kan\s+avser|delm[aå]l|ämne|amne)/i
    );
    let body = (desc ?? "").trim();
    if (!body) {
      // fallback nära ordet "beskrivning"
      const i = soft.indexOf("beskrivning");
      if (i >= 0) body = raw.slice(Math.max(0, i - 200), Math.min(raw.length, i + 2000));
    }
    if (body) {
      body = body
        .replace(/^[=\-—:\s]+/gm, "")
        .split(/\r?\n/)
        .map(tidyOneLine)
        .filter(l => !/^(ämne\s+för\s+självständigt\s+skriftligt\s+arbete|beskrivning\s+av\s+det\s+sj[aä]lvst[aä]ndiga\s+skriftliga\s+arbetet|intygande|handledare)\b/i.test(l))
        .join("\n");
      out.description = enforceBulletBreaks(body);
    }
  }

  // HANDLEDARDEL — Begränsa till rutan under "Handledare"
  {
    const handBox = sliceBetweenBlocks(
      layout ?? null,
      /\bhandledare\b/i,
      /(tjänsteställe|tjanstestalle|ort\s+och\s+datum|namnförtydligande|namnfortydligande|intygande|underskrift)/i
    ) || "";

    // Namn
    const nm = handBox.split(/\r?\n/).map(tidyOneLine).find(l => /\s/.test(l) && !/^(handledare|specialitet)\b/i.test(asciiSoft(l)));
    if (nm && !out.supervisorName) out.supervisorName = nm;

    // Specialitet
    const sp = handBox.match(/\b[Ss]pecialitet\s*[:\-]?\s*([A-ZÅÄÖa-zåäö\-]+)/);
    if (sp?.[1] && !out.supervisorSpeciality) out.supervisorSpeciality = firstWordOnly(sp[1]);

    // Tjänsteställe — tittar i blocket för Tjänsteställe/Ort och datum (under samma sektion)
    const siteBox = sliceBetweenBlocks(
      layout ?? null,
      /(tjänsteställe|tjanstestalle)/i,
      /(ort\s+och\s+datum|namnförtydligande|namnfortydligande|intygande|underskrift)/i
    );
    if (siteBox) {
      const line = siteBox.split(/\r?\n/).map(tidyOneLine).find(Boolean) || "";
      if (line) {
        out.supervisorSite = line
          .replace(/\b\d{4}[.\-\/ ]\d{2}[.\-\/ ]\d{2}\b/g, " ") // bort datum
          .replace(/\s{2,}/g, " ").trim();
      }
    }
  }

  return out;
}

// ---- små hjälpare ----
function mapBack(original: string, normalized: string, idx: number) {
  let acc = 0;
  for (let i = 0; i < original.length; i++) {
    const n = asciiSoft(original[i]);
    acc += Math.max(1, n.length);
    if (acc >= idx) return i;
  }
  return original.length - 1;
}
