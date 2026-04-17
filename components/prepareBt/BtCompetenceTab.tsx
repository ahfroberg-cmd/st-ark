"use client";

import { LabeledInputLocal, ReadonlyInput } from "@/components/prepareBt/InputFields";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function BtCompetenceTab({ profile, setProfile, setDirty }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <h3
          className="mb-2 text-sm font-extrabold"
          data-info="Visar information om huvudhandledaren som är hämtad från din profil. Denna information är skrivskyddad här och kan ändras i profilinställningarna. Information om huvudhandledaren kommer att inkluderas i intyget för uppnådd baskompetens."
        >
          Huvudhandledare
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ReadonlyInput label="Namn" value={String((profile as any)?.supervisor ?? "")} />
          <ReadonlyInput
            label="Specialitet"
            value={String((profile as any)?.supervisorSpecialty ?? (profile as any)?.specialty ?? "")}
          />
          <ReadonlyInput
            label="Tjänsteställe"
            value={String(((profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic) ?? "")}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h3
          className="mb-2 text-sm font-extrabold"
          data-info="Här kan du ange information om en extern bedömare som har bedömt din baskompetens. Om en extern bedömare har använts kan du ange deras namn, specialitet och tjänsteställe. Denna information kommer att inkluderas i intyget för uppnådd baskompetens om den är ifylld."
        >
          Extern bedömare
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <LabeledInputLocal
            label="Namn på extern bedömare"
            value={(profile as any)?.btExtAssessorName || ""}
            onCommit={(v) => {
              setProfile((prev) => (prev ? ({ ...prev, btExtAssessorName: v } as any) : prev));
              setDirty(true);
            }}
          />
          <LabeledInputLocal
            label="Specialitet"
            value={(profile as any)?.btExtAssessorSpec || ""}
            onCommit={(v) => {
              setProfile((prev) => (prev ? ({ ...prev, btExtAssessorSpec: v } as any) : prev));
              setDirty(true);
            }}
          />
          <LabeledInputLocal
            label="Tjänsteställe"
            value={(profile as any)?.btExtAssessorWorkplace || ""}
            onCommit={(v) => {
              setProfile((prev) => (prev ? ({ ...prev, btExtAssessorWorkplace: v } as any) : prev));
              setDirty(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
