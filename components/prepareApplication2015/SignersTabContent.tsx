"use client";

import { LabeledInputLocal, ReadonlyInput } from "@/components/prepareApplication2015/InputFields";

type Props = {
  profile: any;
  cert: any;
  setCert: React.Dispatch<React.SetStateAction<any>>;
  managerModeChangedRef: React.MutableRefObject<boolean>;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export function SignersTabContent({
  profile,
  cert,
  setCert,
  managerModeChangedRef,
  setDirty,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-extrabold">Studierektor</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReadonlyInput
            label="Namn"
            value={
              (profile as any)?.studyDirector ||
              [(profile as any)?.studyDirectorFirstName, (profile as any)?.studyDirectorLastName]
                .filter(Boolean)
                .join(" ") ||
              cert.studyDirector ||
              ""
            }
          />
          <ReadonlyInput label="Tjänsteställe" value={(profile as any)?.homeClinic || ""} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-extrabold">Huvudansvarig handledare</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReadonlyInput
            label="Namn"
            value={
              (profile as any)?.supervisor ||
              [(profile as any)?.supervisorFirstName, (profile as any)?.supervisorLastName]
                .filter(Boolean)
                .join(" ") ||
              cert.mainSupervisor.name ||
              ""
            }
          />

          <ReadonlyInput
            label="Tjänsteställe"
            value={String((profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || cert.mainSupervisor.workplace || "")}
          />

          <LabeledInputLocal
            label="Specialitet"
            value={cert.mainSupervisor.specialty || String((profile as any)?.specialty ?? "")}
            onCommit={(v) =>
              setCert((s: any) => ({
                ...s,
                mainSupervisor: { ...s.mainSupervisor, specialty: v },
              }))
            }
          />

          <LabeledInputLocal
            label="Årtal för handledarutbildning"
            value={cert.mainSupervisor.trainingYear}
            onCommit={(v) =>
              setCert((s: any) => ({
                ...s,
                mainSupervisor: { ...s.mainSupervisor, trainingYear: v },
              }))
            }
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-extrabold">Verksamhetschef / utsedd specialist</h3>

        <select
          className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          value={cert.managerMode}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value as "self" | "appointed";
            managerModeChangedRef.current = true;
            setCert((s: any) => ({
              ...s,
              managerMode: v,
            }));
            setDirty(true);
          }}
        >
          <option value="self">
            Verksamhetschefen har specialistkompetens och intygar själv ST-läkarens specialistkompetens.
          </option>
          <option value="appointed">
            Verksamhetschefen har utsett en läkare med specialistkompetens att bedöma ST-läkarens specialistkompetens
          </option>
        </select>

        {cert.managerMode === "self" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadonlyInput label="Verksamhetschef" value={(profile as any)?.verksamhetschef || ""} />
            <LabeledInputLocal
              label="Tjänsteställe"
              value={cert.managerSelf.workplace || (profile as any)?.homeClinic || ""}
              onCommit={(v) => setCert((s: any) => ({ ...s, managerSelf: { ...s.managerSelf, workplace: v } }))}
            />
            <LabeledInputLocal
              label="Specialitet"
              value={cert.managerSelf.specialty || (profile as any)?.specialty || ""}
              onCommit={(v) => setCert((s: any) => ({ ...s, managerSelf: { ...s.managerSelf, specialty: v } }))}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ReadonlyInput label="Verksamhetschef" value={(profile as any)?.verksamhetschef || ""} />
              <LabeledInputLocal
                label="Verksamhetschefens tjänsteställe"
                value={cert.managerAppointed.managerWorkplace || (profile as any)?.homeClinic || ""}
                onCommit={(v) =>
                  setCert((s: any) => ({ ...s, managerAppointed: { ...s.managerAppointed, managerWorkplace: v } }))
                }
              />
              <LabeledInputLocal
                label="Verksamhetschefens specialitet"
                value={cert.managerAppointed.managerSpecialty || (profile as any)?.specialty || ""}
                onCommit={(v) =>
                  setCert((s: any) => ({ ...s, managerAppointed: { ...s.managerAppointed, managerSpecialty: v } }))
                }
              />
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <LabeledInputLocal
                label="Utsedd specialistläkare"
                value={cert.managerAppointed.specialistName}
                onCommit={(v) =>
                  setCert((s: any) => ({ ...s, managerAppointed: { ...s.managerAppointed, specialistName: v } }))
                }
              />
              <LabeledInputLocal
                label="Utsedd specialistläkares specialitet"
                value={cert.managerAppointed.specialistSpecialty}
                onCommit={(v) =>
                  setCert((s: any) => ({
                    ...s,
                    managerAppointed: { ...s.managerAppointed, specialistSpecialty: v },
                  }))
                }
              />
              <LabeledInputLocal
                label="Utsedd specialistläkares tjänsteställe"
                value={cert.managerAppointed.specialistWorkplace}
                onCommit={(v) =>
                  setCert((s: any) => ({
                    ...s,
                    managerAppointed: { ...s.managerAppointed, specialistWorkplace: v },
                  }))
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
