"use client";

import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";

export default function PusslaSafetyDialogs(props: {
  goHomeWarnOpen: boolean;
  setGoHomeWarnOpen: (value: boolean) => void;
  setSaveInfoOpen: (value: boolean) => void;
  onGoHome: () => void;
  showCloseConfirm: boolean;
  pendingSwitchPlacementId: string | null;
  pendingSwitchCourseId: string | null;
  handleCancelClose: () => void;
  handleConfirmClose: () => void;
  handleSaveAndClose: () => void;
  showDeleteConfirm: boolean;
  deleteConfirmConfig: { message?: string; onConfirm: () => void } | null;
  setShowDeleteConfirm: (value: boolean) => void;
  setDeleteConfirmConfig: (value: any) => void;
  logoutConfirmOpen: boolean;
  setLogoutConfirmOpen: (value: boolean) => void;
  onConfirmLogout: () => Promise<void>;
}) {
  return (
    <>
      {props.goHomeWarnOpen && (
        <div className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <header className="border-b px-6 py-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold m-0">Innan du gar vidare</h3>
              <button
                onClick={() => props.setGoHomeWarnOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Avbryt
              </button>
            </header>

            <div className="p-6">
              <p className="text-slate-700 mb-6">
                All data sparas automatiskt i databasen. Vill du spara en version av din tidslinje innan du gar till startsidan?
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    props.setGoHomeWarnOpen(false);
                    props.setSaveInfoOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-2-2Zm0 2v3H7V5h10ZM7 10h10v9H7v-9Z" />
                  </svg>
                  Spara version
                </button>
                <button
                  onClick={() => {
                    props.setGoHomeWarnOpen(false);
                    props.onGoHome();
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:border-slate-700 hover:bg-slate-700 active:translate-y-px"
                >
                  Ga till startsidan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesDialog
        open={props.showCloseConfirm}
        title="Osparade andringar"
        message={
          props.pendingSwitchPlacementId !== null || props.pendingSwitchCourseId !== null
            ? "Det finns osparade andringar. Vill du spara innan du byter?"
            : "Det finns osparade andringar. Vill du stanga utan att spara?"
        }
        onCancel={props.handleCancelClose}
        onDiscard={props.handleConfirmClose}
        onSaveAndClose={props.handleSaveAndClose}
      />

      <DeleteConfirmDialog
        open={props.showDeleteConfirm}
        title="Ta bort"
        message={props.deleteConfirmConfig?.message || "Ar du saker pa att du vill ta bort detta?"}
        onCancel={() => {
          props.setShowDeleteConfirm(false);
          props.setDeleteConfirmConfig(null);
        }}
        onConfirm={() => {
          props.deleteConfirmConfig?.onConfirm();
        }}
      />

      <LogoutConfirmDialog
        open={props.logoutConfirmOpen}
        onCancel={() => props.setLogoutConfirmOpen(false)}
        onConfirm={props.onConfirmLogout}
      />
    </>
  );
}
