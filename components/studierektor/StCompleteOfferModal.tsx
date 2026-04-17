"use client";

export default function StCompleteOfferModal({
  offer,
  onNo,
  onYes,
}: {
  offer: { studentId: string; name: string } | null;
  onNo: () => void;
  onYes: () => void;
}) {
  if (!offer) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="st-complete-offer-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <p id="st-complete-offer-title" className="text-base text-slate-800">
          <span className="font-semibold">{offer.name}</span> är klar med sin ST! Flytta till listan över tidigare ST-läkare?
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onNo}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Nej
          </button>
          <button
            type="button"
            onClick={onYes}
            className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Ja
          </button>
        </div>
      </div>
    </div>
  );
}
