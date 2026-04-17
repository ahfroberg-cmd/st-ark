# Modulär refaktor – exekveringsplan

Mål: separera ansvar (UI/render, hooks, domän, IO, utils, typer) och minska dolda monoliter. Verifiering efter varje etapp: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Prioriteringskö (samma som uppdrag)

1. `lib/exporters.ts` ✅ etapp 1 klar
2. `components/PrepareBtModal.tsx` ✅ etapp 2-8 klar (inkl. intyg-modal extraherad; under 1500 LOC)
3. `components/PrepareApplicationModal2015.tsx` ✅ etapp 9-15 klar (under 1500 LOC, domän/hook/render separerade)
4. `components/PrepareApplicationModal2021.tsx` 🔄 etapp 16-19 delklara (under 1500 LOC)
5. `components/MilestoneOverviewModal.tsx` ✅ etapp 20-23 klar (under 1500 LOC)
6. `components/ScanIntygModal.tsx` ✅ etapp 24-30 klar (under 1500 LOC; hooks + delkomponenter)
7. `app/studierektor/page.tsx` 🔄 etapp 31-33 delklara (nu under 1500 LOC; ytterligare orkestrering kan brytas ut)
8. `components/IupModal.tsx`
9. `components/StudierektorDashboard.tsx`
10. `components/PusslaDinST.tsx` (stegvis, tydliga ansvarszoner)

## Etapp 1 – `lib/exporters.ts`

**Ansvarszoner identifierade**

- Typer (`GoalsVersion`, `Profile`, `Placement`, `ExportInput`, …)
- Mall-sökvägar och PDF-koordinater (konstanter)
- IO + lågnivå-PDF-hjälpare (`fetchPublicPdf`, nedladdning, blob, `drawText`)
- Domän: `fill2021Generic`, `export2015Generic`, `export2015GenericWithDelmal`
- Domän: BT 2021 bilaga 1–4 (mallfyllning + `drawWrapped`)
- Förhands-PDF: `exportBt2021` + `drawHeaderBlock`
- Orkestrering + offentligt API: `exportCertificate` och befintliga lazy-exporters

**Genomförande**

- Nya moduler under `lib/exporters/` som äger respektive zon.
- `lib/exporters.ts` behåller globala polyfills för äldre bundlad kod, `exportCertificate`-orkestrering och re-export av typer/funktioner så att befintliga imports (`@/lib/exporters`) inte bryts.

## Logg (fylls i vid varje färdig etapp)

| Etapp | Datum | Kort vad som flyttats | Målfil radantal (efter) |
|-------|-------|----------------------|-------------------------|
| 1     | 2026-04-14 | Typer, konstanter, IO-hjälpare, BT-bilaga-fyllare, preview-PDF och generiska fyllare flyttade till `lib/exporters/*`; `lib/exporters.ts` reducerad till orkestrering + API | 527 |
| 2     | 2026-04-14 | BT preview/export-domän flyttad från `PrepareBtModal` till `components/prepareBt/previewBuilders.ts` + separat preview-UI i `CertificatePreviewModal.tsx`; modalen orkestrerar nu anropen | 2754 |
| 3     | 2026-04-14 | Hjälpare (`makeId`, datum, BT-goal-extraktion), lokala typer och input-/readonly-fält flyttade till `components/prepareBt/modalHelpers.ts`, `modalTypes.ts`, `InputFields.tsx` | 2559 |
| 4     | 2026-04-14 | Bilagefärger/sortering flyttad till `components/prepareBt/attachmentsUtils.ts`; `PrepareBtModal` använder nu extern util för UI-färg och ordningsnormalisering | 2458 |
| 5     | 2026-04-14 | Chooser-modal, BT-intygsfooter och intyg-goal-picker-rendering flyttad till `components/prepareBt/RegisteredActivitiesChooserModal.tsx`, `BtPreviewActionFooter.tsx`, `IntygGoalsPickerModal.tsx`; `PrepareBtModal` fortsätter som tydligare orkestrator | 2286 |
| 6     | 2026-04-14 | Hela `attachments`-flikens renderzon (draglista + bilageval + prelicense/utländsk-sektioner) flyttad till `components/prepareBt/AttachmentsTab.tsx`; modalen orkestrerar via explicita handlers/props | 1890 |
| 7     | 2026-04-14 | `btfull`- och `competence`-renderzoner flyttade till `components/prepareBt/BtFullTab.tsx` och `BtCompetenceTab.tsx`; `PrepareBtModal` minskad till central state-/flow-orkestrering | 1742 |
| 8     | 2026-04-14 | Intyg-popupen (prelicense/utländsk) flyttad från `PrepareBtModal` till `components/prepareBt/IntygDetailsModal.tsx`; modalen reducerad till state/flow-orkestrator under målnivån | 1461 |
| 9     | 2026-04-14 | Start på `PrepareApplicationModal2015`: signers-renderzon flyttad till `components/prepareApplication2015/SignersTabContent.tsx` och återanvändbara inputfält till `components/prepareApplication2015/InputFields.tsx` | 2605 |
| 10    | 2026-04-14 | `attachments`-renderzonen i `PrepareApplicationModal2015` flyttad till `components/prepareApplication2015/AttachmentsTabContent.tsx`; huvudfilen orkestrerar nu via props/callbacks | 2455 |
| 11    | 2026-04-14 | Bilage-domän (typer, färg-/label-/sorteringslogik och default-byggare) flyttad till `components/prepareApplication2015/attachmentsDomain.ts`; huvudfilen använder nu importerad domänlogik | 2124 |
| 12    | 2026-04-14 | Preset- och bilage-stateflöde (toggle/rebuild/date-sync + preset-säkring vid öppning) flyttad till `components/prepareApplication2015/useAttachmentsPresetState.ts`; huvudfilen reducerad till orchestration av hook/state | 1954 |
| 13    | 2026-04-14 | Baseline/dirty/close/save-orchestrering (inkl. Cmd/Ctrl+Enter-spara och restore vid stängning) flyttad till `components/prepareApplication2015/useModalCloseAndSave.ts`; huvudfilen fokuserar på domän- och UI-orkestrering | 1881 |
| 14    | 2026-04-14 | Inbyggd PDF-förhandsvisning flyttad från `PrepareApplicationModal2015` till `components/prepareApplication2015/CertificatePreview.tsx` för renare render-ansvar i huvudfilen | 1833 |
| 15    | 2026-04-14 | Init/load-migreringsflöde (Supabase + localStorage-fallback + bilageinit + prefill) flyttad till `components/prepareApplication2015/useInitialLoad2015.ts`; målfilen reducerad under målnivån | 1475 |
| 16    | 2026-04-14 | Start på `PrepareApplicationModal2021`: återanvändbara inputfält (`LabeledInputLocal`, `ReadonlyInput`) flyttade till `components/prepareApplication2021/InputFields.tsx` för renare render-ansvar i huvudfilen | 2358 |
| 17    | 2026-04-14 | Bilage-domän för 2021 (typer, färgkonstanter, namn/label/sortering samt default-byggare) flyttad till `components/prepareApplication2021/attachmentsDomain.ts`; huvudfilen använder importerad domänlogik | 2067 |
| 18    | 2026-04-14 | Preset-/bilage-stateflöde (state, rebuild/toggle/date-update, temp-order-sync och preset-säkring vid öppning) flyttad till `components/prepareApplication2021/useAttachmentsPresetState.ts`; huvudfilen reducerad till orchestration | 1923 |
| 19    | 2026-04-14 | Init/load-migrering (Supabase/localStorage + prefill + bilageinit) och baseline/dirty/save/close-flöde för 2021 flyttat till `components/prepareApplication2021/useInitialLoad2021.ts` samt generisk `useModalCloseAndSave`; huvudfilen passerar målnivån | 1482 |
| 20    | 2026-04-14 | Start på `MilestoneOverviewModal`: normalisering av Supabase-data flyttad till `components/milestoneOverview/dataNormalization.ts` och BT/ST-status-/räknelogik flyttad till `components/milestoneOverview/activityMetrics.ts`; huvudfilen reducerad till tydligare UI-orkestrering | 2012 |
| 21    | 2026-04-14 | List-/detail-domän för `MilestoneOverviewModal` extraherad till `components/milestoneOverview/listDomain.ts` (matchning, deduplicering, listpayload och titeluppslag); huvudfilen reducerad ytterligare | 1734 |
| 22    | 2026-04-14 | Detail-popupens state/IO-handlers (dirty/save/close, suggestion-markering och planpersistens) flyttad till `components/milestoneOverview/useMilestoneDetailState.ts`; `MilestoneOverviewModal` reducerad till UI/render + wiring | 1628 |
| 23    | 2026-04-14 | ST-detaljpopupens render + milestone-resolution flyttad till `components/milestoneOverview/StMilestoneDetailModal.tsx` (inkl. textarea/suggestion-layoutlogik); huvudfilen passerar målnivån | 1365 |
| 24    | 2026-04-14 | Start på `ScanIntygModal`: dokumentväljarens IO/state (Supabase-load, mappar/filter, befintligt-dokument-download) flyttad till `components/scanIntyg/useDocumentPickerState.ts`; huvudfilen reducerad och reset/logik kopplad till hook | 3516 |
| 25    | 2026-04-14 | OCR/scan-pipeline (OCR-körning, klassning/fallbacks, parser-orkestrering, datum-/delmål-/klinik-normalisering) flyttad till `components/scanIntyg/useScanPipeline.ts`; `ScanIntygModal` reducerad till UI + state wiring | 3087 |
| 26    | 2026-04-14 | Save-zonen (validering, map/save, dokumentkoppling och timeline-sync) flyttad till `components/scanIntyg/useSaveScannedCertificate.ts`; `ScanIntygModal` reducerad till formulär/state/render-wiring | 2485 |
| 27    | 2026-04-14 | Review-formulärets stora renderzon (fält, datumblock och save-footer) flyttad till `components/scanIntyg/ScannedCertificateReviewForm.tsx`; huvudfilen reducerad till modal-/flow-orkestrering | 2007 |
| 28    | 2026-04-14 | Upload-zonen och dokumentväljardialogens render flyttade till `components/scanIntyg/ScanUploadStep.tsx` och `components/scanIntyg/DocumentsPickerDialog.tsx`; `ScanIntygModal` renodlad till flow/state-wiring för upload/picker | 1743 |
| 29    | 2026-04-14 | ~1,1k rader duplicerad OCR-/parse-hjälp i filens slut (aldrig anropad; motsvarande logik finns i `useScanPipeline.ts`) borttagen; oanvänd `visible` borttagen | 578 |
| 30    | 2026-04-14 | Tips- och GDPR-overlay-render flyttad till `components/scanIntyg/ScanIntygInfoOverlays.tsx`; huvudfilen fokuserar på huvudmodal + wiring | 482 |
| 31    | 2026-04-14 | Start på `app/studierektor/page.tsx`: `StudentDetailModal` flyttad till `components/studierektor/StudentDetailModal.tsx`; student-/list-/varningshjälpare till `lib/studierektor/studierektorPageStudentUtils.ts`; `handledare/page.tsx` importerar modal från komponent | 1324 |
| 32    | 2026-04-14 | Elevlistans `<main>` (nuvarande/tidigare tabeller, tomma tillstånd, sortering) flyttad till `components/studierektor/StudierektorStudentListMain.tsx`; sortkolumn-typ till `lib/studierektor/studierektorStudentListColumns.ts` | 1119 |
| 33    | 2026-04-14 | Info-toast + sidhuvud till `components/studierektor/StudierektorPageChrome.tsx`; samlad modal-/filimport-render till `components/studierektor/StudierektorPageModals.tsx`; `showFlyttaTillTidigare` som `useMemo` på sidan; `WholeGroupProgressionStats` exporterad från `WholeGroupProgressionModal.tsx` | 949 |
