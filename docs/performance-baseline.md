# Performance Baseline

## Referensfloden

1. ST-lakare: redigera vald placering i `PusslaDinST`.
2. ST-lakare: autosave av kurs/placering.
3. Studierektor: ladda studentlista.
4. Handledare: oppna ST-detalj.

## Instrumentering

- `lib/perf.ts` loggar dev-only till console och `window.__starkPerfLog`.
- Fokusmarkorer:
  - `pussla.savePlacementToDb`
  - `pussla.saveCourseToDb`
  - `studierektor.loadStudents`
  - `handledare.loadStudents`
  - `handledare.openStudentDetail`

## Insamling

1. Kor `npm run dev`.
2. Reproducera varje referensflode 3 ganger.
3. Skriv ut median fran `window.__starkPerfLog` i browser console.

```js
const logs = window.__starkPerfLog || [];
const byName = logs.reduce((acc, item) => {
  const n = item.name;
  acc[n] = acc[n] || [];
  acc[n].push(item.durationMs);
  return acc;
}, {});
Object.entries(byName).forEach(([name, vals]) => {
  const s = [...vals].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  console.log(name, "count=", vals.length, "median=", med.toFixed(1), "ms");
});
```

## Mal efter etapp 2

- Minst 30% faerre onodiga refetches i `PusslaDinST` save-floden.
- Minst 20% laegre median for bulk-load i studierektor/handledare.
