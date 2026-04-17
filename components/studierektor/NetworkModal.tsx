"use client";

import type {
  ContactField,
  NetworkDataScope,
  NetworkGroup,
  NetworkSrProfile,
  NetworkShareMode,
} from "@/lib/studierektor/networkTypes";

export default function NetworkModal({
  networkOpen,
  onClose,
  networkNewGroupName,
  setNetworkNewGroupName,
  onCreateGroup,
  networkGroups,
  networkCurrentUserId,
  onOpenGroup,
  onDeleteGhostGroup,
  onDeleteGroup,
  onLeaveGroup,
  networkShareScopes,
  onToggleScope,
  networkShareMode,
  setNetworkShareMode,
  networkSelectedGroupIdsForSharing,
  onToggleGroupShare,
  networkRequestTarget,
  setNetworkRequestTarget,
  networkShowName,
  setNetworkShowName,
  networkShowContact,
  setNetworkShowContact,
  networkContactFields,
  onToggleContactField,
  srProfile,
  onSaveSettings,
}: {
  networkOpen: boolean;
  onClose: () => void;
  networkNewGroupName: string;
  setNetworkNewGroupName: (next: string) => void;
  onCreateGroup: () => void;
  networkGroups: NetworkGroup[];
  networkCurrentUserId: string;
  onOpenGroup: (group: NetworkGroup) => void;
  onDeleteGhostGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
  networkShareScopes: NetworkDataScope[];
  onToggleScope: (scope: NetworkDataScope) => void;
  networkShareMode: NetworkShareMode;
  setNetworkShareMode: (next: NetworkShareMode) => void;
  networkSelectedGroupIdsForSharing: string[];
  onToggleGroupShare: (groupId: string) => void;
  networkRequestTarget: string;
  setNetworkRequestTarget: (next: string) => void;
  networkShowName: boolean;
  setNetworkShowName: (next: boolean) => void;
  networkShowContact: boolean;
  setNetworkShowContact: (next: boolean) => void;
  networkContactFields: ContactField[];
  onToggleContactField: (field: ContactField) => void;
  srProfile: NetworkSrProfile | null;
  onSaveSettings: () => void;
}) {
  if (!networkOpen) return null;

  const contactPreview: string[] = [];
  if (networkShowName) contactPreview.push(srProfile?.name || "Namn");
  if (networkShowContact) {
    if (networkContactFields.includes("email") && srProfile?.email) contactPreview.push(srProfile.email);
    if (networkContactFields.includes("mobile") && srProfile?.mobile) contactPreview.push(srProfile.mobile);
    if (networkContactFields.includes("phone_work") && srProfile?.phone_work) contactPreview.push(srProfile.phone_work);
  }

  return (
    <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Nätverk</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Stäng
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-130px)] grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">1. Grupper</h3>
            <div className="flex gap-2">
              <input
                value={networkNewGroupName}
                onChange={(e) => setNetworkNewGroupName(e.target.value)}
                placeholder="Nytt gruppnamn"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={onCreateGroup}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Skapa
              </button>
            </div>
            <div className="space-y-2">
              {networkGroups.map((group) => {
                const isAdmin = !!networkCurrentUserId && group.adminUserIds.includes(networkCurrentUserId);
                const isMember = !!networkCurrentUserId && group.memberUserIds.includes(networkCurrentUserId);
                const isGhost = group.memberUserIds.length === 0 && group.adminUserIds.length === 0;
                return (
                  <div key={group.id} className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenGroup(group)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <div className="font-semibold text-slate-900">{group.name}</div>
                      <div className="text-xs text-slate-600">
                        {group.memberUserIds.length} medlemmar · {group.adminUserIds.length} admin
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col justify-center gap-1">
                      {isGhost ? (
                        <button
                          type="button"
                          title="Ta bort tom grupp från listan"
                          onClick={() => {
                            if (window.confirm("Ta bort denna grupp från listan?")) onDeleteGhostGroup(group.id);
                          }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Rensa
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <button
                          type="button"
                          title="Ta bort hela gruppen"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Ta bort gruppen? Alla medlemmar tappar åtkomst i denna vy (lokalt sparat).",
                              )
                            ) {
                              onDeleteGroup(group.id);
                            }
                          }}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                        >
                          Ta bort
                        </button>
                      ) : null}
                      {isMember ? (
                        <button
                          type="button"
                          title="Lämna gruppen"
                          onClick={() => {
                            if (window.confirm("Lämna denna grupp?")) onLeaveGroup(group.id);
                          }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Lämna
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">2. Vad du delar</h3>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={networkShareScopes.includes("activities")}
                onChange={() => onToggleScope("activities")}
              />
              Utbildningsaktiviteter (placeringar, kurser, utbildningsmoment och detaljförslag)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={networkShareScopes.includes("iup_headers")}
                onChange={() => onToggleScope("iup_headers")}
              />
              Rubriker till IUP
            </label>
            <div className="pt-2 text-xs text-slate-500">Statistik för egna ST-läkare delas inte i denna version.</div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">3. Delningsnivå</h3>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="network-share-mode"
                checked={networkShareMode === "open"}
                onChange={() => setNetworkShareMode("open")}
              />
              Dela öppet
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="network-share-mode"
                checked={networkShareMode === "group"}
                onChange={() => setNetworkShareMode("group")}
              />
              Dela med grupp
            </label>
            {networkShareMode === "group" ? (
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-1 text-xs font-semibold text-slate-700">Välj grupper</div>
                <div className="space-y-1">
                  {networkGroups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={networkSelectedGroupIdsForSharing.includes(g.id)}
                        onChange={() => onToggleGroupShare(g.id)}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="network-share-mode"
                checked={networkShareMode === "request"}
                onChange={() => setNetworkShareMode("request")}
              />
              Dela på förfrågan från specifik person
            </label>
            {networkShareMode === "request" ? (
              <input
                value={networkRequestTarget}
                onChange={(e) => setNetworkRequestTarget(e.target.value)}
                placeholder="Namn eller e-post till studierektor"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">4. Synlighet och kontakt</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={networkShowName} onChange={(e) => setNetworkShowName(e.target.checked)} />
                  Visa mitt namn
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={networkShowContact}
                    onChange={(e) => setNetworkShowContact(e.target.checked)}
                  />
                  Visa kontaktuppgifter
                </label>
                <div className="pl-6 space-y-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!networkShowContact}
                      checked={networkContactFields.includes("email")}
                      onChange={() => onToggleContactField("email")}
                    />
                    E-post
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!networkShowContact}
                      checked={networkContactFields.includes("mobile")}
                      onChange={() => onToggleContactField("mobile")}
                    />
                    Mobil
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!networkShowContact}
                      checked={networkContactFields.includes("phone_work")}
                      onChange={() => onToggleContactField("phone_work")}
                    />
                    Telefon arbete
                  </label>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-700">Förhandsvisning</div>
                <div className="mt-1 text-sm text-slate-800">
                  {contactPreview.length > 0 ? contactPreview.join(" · ") : "Ingen information delas publikt"}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <div className="text-xs text-slate-500">
            Delningsunderlag: {networkShareScopes.includes("activities") ? "Utbildningsaktiviteter" : ""}
            {networkShareScopes.includes("activities") && networkShareScopes.includes("iup_headers") ? " + " : ""}
            {networkShareScopes.includes("iup_headers") ? "IUP-rubriker" : ""}
          </div>
          <button
            type="button"
            onClick={onSaveSettings}
            className="rounded-lg border border-slate-300 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
}
