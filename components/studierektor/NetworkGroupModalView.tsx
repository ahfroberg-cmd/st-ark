"use client";

import type {
  ContactField,
  NetworkClinicOption,
  NetworkClinicRegionContext,
  NetworkDataScope,
  NetworkGroup,
  NetworkGroupTab,
  NetworkInviteMode,
  NetworkParticipant,
  NetworkSrProfile,
} from "@/lib/studierektor/networkTypes";

export default function NetworkGroupModalView({
  networkGroupOpen,
  setNetworkGroupOpen,
  currentGroup,
  currentMembers,
  isActiveNetworkGroupAdmin,
  deleteNetworkGroupById,
  viewerIsMember,
  leaveNetworkGroupById,
  networkGroupTab,
  setNetworkGroupTab,
  networkCurrentUserId,
  srProfile,
  clinicName,
  clinicRegionContext,
  networkSelectedMemberId,
  setNetworkSelectedMemberId,
  networkShowName,
  networkShowContact,
  networkContactFields,
  networkShareScopes,
  networkGroupRename,
  setNetworkGroupRename,
  renameGroup,
  networkInviteMode,
  setNetworkInviteMode,
  setNetworkInviteHospital,
  setNetworkInviteClinicId,
  networkInviteRegion,
  setNetworkInviteRegion,
  regionOptions,
  networkInviteHospital,
  hospitalOptions,
  networkInviteClinicId,
  clinicOptions,
  networkInviteUserId,
  setNetworkInviteUserId,
  inviteCandidates,
  inviteTarget,
  addMember,
  networkParticipantsLoading,
  promoteAdmin,
  removeMember,
}: {
  networkGroupOpen: boolean;
  setNetworkGroupOpen: (open: boolean) => void;
  currentGroup: NetworkGroup;
  currentMembers: NetworkParticipant[];
  isActiveNetworkGroupAdmin: boolean;
  deleteNetworkGroupById: (groupId: string) => void;
  viewerIsMember: boolean;
  leaveNetworkGroupById: (groupId: string) => void;
  networkGroupTab: NetworkGroupTab;
  setNetworkGroupTab: (tab: NetworkGroupTab) => void;
  networkCurrentUserId: string;
  srProfile: NetworkSrProfile | null;
  clinicName: string;
  clinicRegionContext: NetworkClinicRegionContext | null;
  networkSelectedMemberId: string;
  setNetworkSelectedMemberId: (id: string | ((prev: string) => string)) => void;
  networkShowName: boolean;
  networkShowContact: boolean;
  networkContactFields: ContactField[];
  networkShareScopes: NetworkDataScope[];
  networkGroupRename: string;
  setNetworkGroupRename: (v: string) => void;
  renameGroup: () => void;
  networkInviteMode: NetworkInviteMode;
  setNetworkInviteMode: (mode: NetworkInviteMode) => void;
  setNetworkInviteHospital: (v: string) => void;
  setNetworkInviteClinicId: (v: string) => void;
  networkInviteRegion: string;
  setNetworkInviteRegion: (v: string) => void;
  regionOptions: string[];
  networkInviteHospital: string;
  hospitalOptions: string[];
  networkInviteClinicId: string;
  clinicOptions: NetworkClinicOption[];
  networkInviteUserId: string;
  setNetworkInviteUserId: (v: string) => void;
  inviteCandidates: NetworkParticipant[];
  inviteTarget: NetworkParticipant | null;
  addMember: () => void;
  networkParticipantsLoading: boolean;
  promoteAdmin: (userId: string) => void;
  removeMember: (userId: string) => void;
}) {
  if (!networkGroupOpen || !currentGroup) return null;

  return (
    <div className="fixed inset-0 z-[530] flex items-center justify-center bg-black/60 p-4" onClick={() => setNetworkGroupOpen(false)}>
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="text-base font-bold text-slate-900">{currentGroup.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            {isActiveNetworkGroupAdmin ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Ta bort hela gruppen? Alla medlemmar tappar åtkomst i denna vy (lokalt sparat)."
                    )
                  ) {
                    deleteNetworkGroupById(currentGroup.id);
                  }
                }}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
              >
                Ta bort grupp
              </button>
            ) : null}
            {viewerIsMember ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Lämna denna grupp?")) leaveNetworkGroupById(currentGroup.id);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Lämna grupp
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setNetworkGroupOpen(false)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Stäng
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 pt-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setNetworkGroupTab("group")}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                networkGroupTab === "group"
                  ? "border-x border-t border-slate-200 bg-white text-slate-900 -mb-px"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {currentGroup.name}
            </button>
            {isActiveNetworkGroupAdmin ? (
              <button
                type="button"
                onClick={() => setNetworkGroupTab("admin")}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  networkGroupTab === "admin"
                    ? "border-x border-t border-slate-200 bg-white text-slate-900 -mb-px"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Admin
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5">
          {networkGroupTab === "group" ? (
            <section className="space-y-2">
              <p className="text-xs text-slate-600">Klicka på en medlem för att se vad hen delar i gruppen.</p>
              {currentMembers.map((member) => {
                const isSelf = member.userId === networkCurrentUserId;
                const displayName =
                  isSelf && srProfile?.name?.trim() ? srProfile.name.trim() : member.name;
                const displayClinic =
                  member.clinicName?.trim() || (isSelf && clinicName ? clinicName : "") || "Okänd klinik";
                const displayRegion =
                  member.region?.trim() ||
                  (isSelf && clinicRegionContext?.regionLabel ? clinicRegionContext.regionLabel : "") ||
                  "";
                const expanded = networkSelectedMemberId === member.userId;
                return (
                  <div
                    key={member.userId}
                    className={`overflow-hidden rounded-xl border text-sm ${
                      expanded ? "border-sky-300 bg-sky-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setNetworkSelectedMemberId((prev) => (prev === member.userId ? "" : member.userId))
                      }
                      className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50/80"
                    >
                      <span>
                        <span className="font-semibold text-slate-900">{displayName}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {displayClinic}
                          {displayRegion ? ` · ${displayRegion}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">{expanded ? "▲" : "▼"}</span>
                    </button>
                    {expanded ? (
                      <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">Visas som: </span>
                          {isSelf ? (networkShowName ? displayName : "Namn dolt") : displayName}
                        </div>
                        {isSelf && networkShowContact ? (
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">Kontakt: </span>
                            {[
                              networkContactFields.includes("email") && srProfile?.email,
                              networkContactFields.includes("mobile") && srProfile?.mobile,
                              networkContactFields.includes("phone_work") && srProfile?.phone_work,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Inga valda fält"}
                          </div>
                        ) : null}
                        {!isSelf && (member.email || member.mobile || member.phoneWork) ? (
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">Kontakt: </span>
                            {[member.email, member.mobile, member.phoneWork].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                        {isSelf ? (
                          <>
                            {networkShareScopes.includes("activities") ? (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                Utbildningsaktiviteter: placeringar, kurser, utbildningsmoment och detaljförslag som du skapat.
                              </div>
                            ) : null}
                            {networkShareScopes.includes("iup_headers") ? (
                              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                IUP-rubriker som du valt att dela.
                              </div>
                            ) : null}
                            {!networkShareScopes.includes("activities") && !networkShareScopes.includes("iup_headers") ? (
                              <div className="text-xs text-slate-500">Du har inte valt något att dela ännu.</div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              Utbildningsaktiviteter, kurser, moment och förslag som denna studierektor valt att dela (visas
                              fullt ut när nätverksdelning är kopplad till servern).
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              IUP-rubriker som denna studierektor valt att dela (samma som ovan).
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {currentMembers.length === 0 ? <div className="text-sm text-slate-500">Inga medlemmar ännu.</div> : null}
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Gruppinställningar</h3>
                <div className="flex gap-2">
                  <input
                    value={networkGroupRename}
                    onChange={(e) => setNetworkGroupRename(e.target.value)}
                    placeholder="Gruppnamn"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={renameGroup}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Spara namn
                  </button>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Bjud in deltagare</h3>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="invite-mode"
                      checked={networkInviteMode === "hospital"}
                      onChange={() => {
                        setNetworkInviteMode("hospital");
                        setNetworkInviteHospital("");
                        setNetworkInviteClinicId("");
                        setNetworkInviteUserId("");
                      }}
                    />
                    Region &gt; Sjukhus &gt; Klinik
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="invite-mode"
                      checked={networkInviteMode === "vardcentral"}
                      onChange={() => {
                        setNetworkInviteMode("vardcentral");
                        setNetworkInviteHospital("");
                        setNetworkInviteClinicId("");
                        setNetworkInviteUserId("");
                      }}
                    />
                    Region &gt; Vårdcentral
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <select
                    value={networkInviteRegion}
                    onChange={(e) => {
                      setNetworkInviteRegion(e.target.value);
                      setNetworkInviteHospital("");
                      setNetworkInviteClinicId("");
                      setNetworkInviteUserId("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Välj region…</option>
                    {regionOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {networkInviteMode === "hospital" ? (
                    <select
                      value={networkInviteHospital}
                      onChange={(e) => {
                        setNetworkInviteHospital(e.target.value);
                        setNetworkInviteClinicId("");
                        setNetworkInviteUserId("");
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Välj sjukhus…</option>
                      {hospitalOptions.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div />
                  )}
                  <select
                    value={networkInviteClinicId}
                    onChange={(e) => {
                      setNetworkInviteClinicId(e.target.value);
                      setNetworkInviteUserId("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  >
                    <option value="">Välj klinik…</option>
                    {clinicOptions.map((c) => (
                      <option key={c.clinicId} value={c.clinicId}>
                        {c.clinicName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={networkInviteUserId}
                    onChange={(e) => setNetworkInviteUserId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                  >
                    <option value="">Välj studierektor…</option>
                    {inviteCandidates.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.name} · {p.clinicName || "Okänd klinik"}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!inviteTarget}
                  onClick={addMember}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                >
                  Bjud in vald deltagare
                </button>
                {networkParticipantsLoading ? <div className="text-xs text-slate-500">Laddar studierektorer…</div> : null}
              </section>

              <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-900">Medlemmar och admin</h3>
                {currentMembers.map((member) => {
                  const isAdmin = currentGroup.adminUserIds.includes(member.userId);
                  const isSelf = member.userId === networkCurrentUserId;
                  return (
                    <div key={member.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="text-sm">
                        <span className="font-semibold text-slate-900">{member.name}</span>
                        <span className="ml-1 text-slate-500">· {member.clinicName || "Okänd klinik"}</span>
                        {isAdmin ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">Admin</span> : null}
                      </div>
                      <div className="flex gap-2">
                        {!isAdmin ? (
                          <button
                            type="button"
                            onClick={() => promoteAdmin(member.userId)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                          >
                            Ge admin
                          </button>
                        ) : null}
                        {!isSelf ? (
                          <button
                            type="button"
                            onClick={() => removeMember(member.userId)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Ta bort
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
