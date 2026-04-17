// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { IntygKind } from "@/lib/intygDetect";
import { validateOcrFile } from "@/lib/validation";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";
import { labelsFor, kindHasDates } from "@/lib/intygParsers/registry";
import {
  useDocumentPickerState,
  type ExistingAppDocument,
} from "@/components/scanIntyg/useDocumentPickerState";
import { useScanPipeline } from "@/components/scanIntyg/useScanPipeline";
import { useSaveScannedCertificate } from "@/components/scanIntyg/useSaveScannedCertificate";
import { ScannedCertificateReviewForm } from "@/components/scanIntyg/ScannedCertificateReviewForm";
import { ScanUploadStep } from "@/components/scanIntyg/ScanUploadStep";
import { DocumentsPickerDialog } from "@/components/scanIntyg/DocumentsPickerDialog";
import { ScanIntygInfoOverlays } from "@/components/scanIntyg/ScanIntygInfoOverlays";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  goalsVersion?: "2015" | "2021";
};

type Step = "upload" | "review";

export default function ScanIntygModal({
  open,
  onClose,
  onSaved,
  goalsVersion,
}: Props) {

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [kind, setKind] = useState<IntygKind | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [gdprModalOpen, setGdprModalOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [baselineParsed, setBaselineParsed] = useState<any>(null);
  const [attachUploadedDocument, setAttachUploadedDocument] = useState(true);
  const [sourceAppDocument, setSourceAppDocument] = useState<ExistingAppDocument | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dirty-state: true om en fil är vald, ett intyg är skannat eller om formuläret är ändrat
  const dirty = useMemo(() => {
    // Om en fil är vald (syns i fönstret)
    if (file !== null || previewUrl !== null) {
      return true;
    }
    // Om vi är i review-steget och har ett skannat intyg
    if (step === "review" && parsed !== null) {
      return true;
    }
    // Om parsed har ändrats från baseline
    if (baselineParsed !== null && parsed !== null) {
      return JSON.stringify(parsed) !== JSON.stringify(baselineParsed);
    }
    return false;
  }, [file, previewUrl, step, parsed, baselineParsed]);

  function resetAll() {
    setStep("upload");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setBusy(false);
    setOcrText("");
    setKind(null);
    setParsed(null);
    setWarning(null);
    setTipsOpen(false);
    setBaselineParsed(null);
    setShowCloseConfirm(false);
    setAttachUploadedDocument(true);
    resetDocumentPickerState();
    setSourceAppDocument(null);
  }

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
    resetAll();
  }, [dirty, onClose]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
    resetAll();
  }, [onClose]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  function handleClose() {
    handleRequestClose();
  }

  function handleForceClose() {
    setShowCloseConfirm(false);
    onClose();
    resetAll();
  }

  const {
    documentPickerOpen,
    setDocumentPickerOpen,
    documentsLoading,
    documentsError,
    documentsQuery,
    setDocumentsQuery,
    selectingDocumentPath,
    pickerFolderKey,
    setPickerFolderKey,
    pickerPlacementsOpen,
    setPickerPlacementsOpen,
    pickerCoursesOpen,
    setPickerCoursesOpen,
    pickerShowDates,
    setPickerShowDates,
    pickerFolderOptions,
    pickerFilteredDocuments,
    pickerSelectedFolderMeta,
    isSupportedStoredDocument,
    loadAvailableDocuments,
    handlePickExistingDocument,
    resetDocumentPickerState,
  } = useDocumentPickerState({
    open,
    onSelectFile,
    setWarning,
  });

  // Registrera modalen för global ESC-hantering
  useEffect(() => {
    if (!open || !overlayRef.current) return;
    registerModal(overlayRef.current, handleRequestClose);
    return () => {
      if (overlayRef.current) {
        unregisterModal(overlayRef.current);
      }
    };
  }, [open, handleRequestClose]);

  function onSelectFile(
    f: File | null,
    options?: { sourceDocument?: ExistingAppDocument | null }
  ) {
    if (!f) return;
    
    // Validera fil innan bearbetning
    const fileValidation = validateOcrFile(f);
    if (!fileValidation.valid) {
      setWarning(fileValidation.error || "Ogiltig fil.");
      return;
    }
    
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    setParsed(null);
    setKind(null);
    setOcrText("");
    setWarning(null);
    setStep("upload");
    setSourceAppDocument(options?.sourceDocument || null);
  }

  const { handleScan } = useScanPipeline({
    file,
    goalsVersion,
    setBusy,
    setWarning,
    setOcrText,
    setKind,
    setParsed,
    setStep,
  });
  const { handleSave } = useSaveScannedCertificate({
    parsed,
    kind,
    file,
    attachUploadedDocument,
    sourceAppDocument,
    onSaved,
    setWarning,
    setBusy,
    setBaselineParsed,
    handleForceClose,
  });

  function removeFile() {
    if (!file) return;
    const ok = confirm("Vill du ta bort vald bild?");
    if (!ok) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setParsed(null);
    setKind(null);
    setOcrText("");
    setSourceAppDocument(null);
  }

  const fileChosen = Boolean(file);
  const canScan = fileChosen && !busy && !selectingDocumentPath;

  const baseMeta = labelsFor(kind);
  let titleLabel = baseMeta.title;
  let clinicLabel = baseMeta.clinicLabel;
  let descriptionLabel = baseMeta.descriptionLabel;

  // Justera rubriker beroende på intygsmall
  switch (kind) {
    // SOSFS 2015:8 – Bilaga 3 (Auskultation)
    case "2015-B3-AUSK":
      if (!titleLabel) titleLabel = "Auskultation";
      clinicLabel = "Tjänstgöringsställe för auskultationen";
      descriptionLabel = "Beskrivning av auskultationen";
      break;

    // SOSFS 2015:8 – Bilaga 4 (Klinisk tjänstgöring)
    case "2015-B4-KLIN":
      if (!titleLabel)
        titleLabel = "Klinisk tjänstgöring under handledning";
      clinicLabel = "Tjänstgöringsställe för den kliniska tjänstgöringen";
      descriptionLabel = "Beskrivning av den kliniska tjänstgöringen";
      break;

    // SOSFS 2015:8 – Bilaga 5 (Kurs)
    case "2015-B5-KURS":
      titleLabel = "Kursens ämne (rubrikform)";
      clinicLabel = ""; // Ingen plats för 2015 kurser
      descriptionLabel = "Beskrivning av kursen";
      break;

    // SOSFS 2015:8 – Bilaga 6 (Kvalitets- och utvecklingsarbete)
    case "2015-B6-UTV":
      titleLabel = "Kvalitets- och utvecklingsarbete";
      clinicLabel = "Ämne";
      descriptionLabel =
        "Beskrivning av kvalitets- och utvecklingsarbetet";
      break;

    // SOSFS 2015:8 – Bilaga 7 (Självständigt skriftligt arbete)
    case "2015-B7-SKRIFTLIGT":
      titleLabel = "Självständigt skriftligt arbete enligt vetenskapliga principer";
      clinicLabel = "Ämne";
      descriptionLabel =
        "Beskrivning av det självständiga skriftliga arbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 8 (Auskultation)
    case "2021-B8-AUSK":
      if (!titleLabel) titleLabel = "Auskultation";
      clinicLabel = "Tjänstgöringsställe för auskultationen";
      descriptionLabel = "Beskrivning av auskultationen";
      break;

    // HSLF-FS 2021:8 – Bilaga 9 (Klinisk tjänstgöring)
    case "2021-B9-KLIN":
      if (!titleLabel)
        titleLabel = "Klinisk tjänstgöring under handledning";
      clinicLabel = "Tjänstgöringsställe för den kliniska tjänstgöringen";
      descriptionLabel = "Beskrivning av den kliniska tjänstgöringen";
      break;

    // HSLF-FS 2021:8 – Bilaga 10 (Kurs)
    case "2021-B10-KURS":
      titleLabel = "Kursens ämne (rubrikform)";
      clinicLabel = ""; // Ingen plats för 2021 kurser
      descriptionLabel = "Beskrivning av kursen";
      break;

    // HSLF-FS 2021:8 – Bilaga 11 (Utvecklingsarbete)
    case "2021-B11-UTV":
      titleLabel = "Utvecklingsarbetets ämne (rubrikform)";
      clinicLabel = "Utvecklingsarbetets ämne";
      descriptionLabel =
        "Beskrivning av ST-läkarens deltagande i utvecklingsarbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 12 (STa3 – medicinsk vetenskap)
    case "2021-B12-STa3":
      titleLabel = "Delmål STa3 – medicinsk vetenskap";
      clinicLabel = "Utbildningsaktiviteter (rubrik/ämne)";
      descriptionLabel = "Samlad beskrivning av det vetenskapliga arbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 13 (tredjeland)
    case "2021-B13-TREDJELAND":
      titleLabel = "Delmål för specialistläkare från tredjeland";
      clinicLabel = "Utbildningsaktiviteter (rubrik/ämne)";
      descriptionLabel = "Beskrivning av utbildningsaktiviteterna";
      break;
  }

  const isNoDates = !kindHasDates(kind);
  const isCourseKind =
    kind === "2015-B5-KURS" || kind === "2021-B10-KURS";

  const previewTitle =
    isCourseKind ? "Kurs" : titleLabel || "";

  const activityTypeLabel = isCourseKind
    ? "kurs"
    : kind === "2015-B4-KLIN" || kind === "2021-B9-KLIN"
    ? "klinisk tjänstgöring"
    : kind === "2015-B3-AUSK" || kind === "2021-B8-AUSK"
    ? "auskultation"
    : kind === "2021-B11-UTV" || kind === "2015-B6-UTV"
    ? "utvecklingsarbete"
    : kind === "2015-B7-SKRIFTLIGT" || kind === "2021-B12-STa3"
    ? "skriftligt arbete"
    : "aktivitet";

  const activityTypeLabelCap =
    activityTypeLabel.charAt(0).toUpperCase() + activityTypeLabel.slice(1);

  const activityFolderBase = isCourseKind
    ? "kurs"
    : kind === "2015-B3-AUSK" || kind === "2021-B8-AUSK"
    ? "auskultation"
    : "placering";

  const activityFolderGenitive = isCourseKind
    ? "kursens"
    : kind === "2015-B3-AUSK" || kind === "2021-B8-AUSK"
    ? "auskultationens"
    : "placeringens";

  const attachDocumentLabel = sourceAppDocument
    ? `Flytta dokument till mapp för ${activityFolderBase}`
    : `Lägg uppladdat dokument i ${activityFolderGenitive} mapp`;

  if (!open) return null;

  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        title="Osparade ändringar"
        message="Du har skannat in ett intyg eller gjort ändringar i formuläret. Vill du stänga utan att spara?"
        onCancel={handleCancelClose}
        onDiscard={handleConfirmClose}
      />
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleRequestClose();
        }}
      >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold">Skanna intyg</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTipsOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              data-info="Visar tips och råd för hur du får bästa möjliga resultat när du skannar intyg med OCR. Inkluderar information om bildkvalitet, ljusförhållanden och positionering."
            >
              Tips för bästa resultat
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              data-info="Stänger skanna intyg-modalen. Om du har valt en fil eller gjort ändringar i formuläret visas en varning innan modalen stängs."
            >
              Stäng
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
            {warning && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-semibold mb-2">Varning:</div>
                <div className="whitespace-pre-line">{warning}</div>
              </div>
            )}

            {/* --- UPLOAD --- */}
            {step === "upload" && (
              <ScanUploadStep
                cameraInputRef={cameraInputRef}
                fileInputRef={fileInputRef}
                onSelectFile={onSelectFile}
                setDocumentPickerOpen={setDocumentPickerOpen}
                previewUrl={previewUrl}
                fileName={file?.name ?? "Visa bild"}
                hasFile={Boolean(file)}
                removeFile={removeFile}
                handleScan={handleScan}
                canScan={canScan}
                busy={busy}
                setGdprModalOpen={setGdprModalOpen}
              />
            )}

            {/* --- REVIEW --- */}
            {step === "review" && (
              <ScannedCertificateReviewForm
                kind={kind}
                parsed={parsed}
                setParsed={setParsed}
                titleLabel={titleLabel}
                clinicLabel={clinicLabel}
                descriptionLabel={descriptionLabel}
                isNoDates={isNoDates}
                isCourseKind={isCourseKind}
                attachUploadedDocument={attachUploadedDocument}
                setAttachUploadedDocument={setAttachUploadedDocument}
                attachDocumentLabel={attachDocumentLabel}
                previewUrl={previewUrl}
                fileName={file?.name ?? "Visa bild"}
                busy={busy}
                handleSave={handleSave}
                activityTypeLabelCap={activityTypeLabelCap}
              />
            )}
        </div>
      </div>

      <DocumentsPickerDialog
        open={documentPickerOpen}
        onClose={() => setDocumentPickerOpen(false)}
        documentsLoading={documentsLoading}
        documentsError={documentsError}
        documentsQuery={documentsQuery}
        setDocumentsQuery={setDocumentsQuery}
        selectingDocumentPath={selectingDocumentPath}
        pickerFolderKey={pickerFolderKey}
        setPickerFolderKey={setPickerFolderKey}
        pickerPlacementsOpen={pickerPlacementsOpen}
        setPickerPlacementsOpen={setPickerPlacementsOpen}
        pickerCoursesOpen={pickerCoursesOpen}
        setPickerCoursesOpen={setPickerCoursesOpen}
        pickerShowDates={pickerShowDates}
        setPickerShowDates={setPickerShowDates}
        pickerFolderOptions={pickerFolderOptions}
        pickerFilteredDocuments={pickerFilteredDocuments}
        pickerSelectedFolderMeta={pickerSelectedFolderMeta}
        loadAvailableDocuments={loadAvailableDocuments}
        handlePickExistingDocument={handlePickExistingDocument}
        isSupportedStoredDocument={isSupportedStoredDocument}
      />

      <ScanIntygInfoOverlays
        tipsOpen={tipsOpen}
        onCloseTips={() => setTipsOpen(false)}
        gdprModalOpen={gdprModalOpen}
        onCloseGdpr={() => setGdprModalOpen(false)}
      />
      </div>
    </>
  );
}
