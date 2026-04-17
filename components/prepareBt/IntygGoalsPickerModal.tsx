"use client";

import BtMilestonePicker from "@/components/BtMilestonePicker";
import type { ForeignOrPrelicenseRow } from "@/components/prepareBt/modalTypes";

type PickerState = { open: boolean; mode: "prelicense" | "foreign" | null; rowId?: string };

type Props = {
  picker: PickerState;
  prelicenseRows: ForeignOrPrelicenseRow[];
  foreignRows: ForeignOrPrelicenseRow[];
  setPrelicenseRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  setForeignRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  defaultIntyg: () => NonNullable<ForeignOrPrelicenseRow["intyg"]>;
  onClose: () => void;
};

export function IntygGoalsPickerModal({
  picker,
  prelicenseRows,
  foreignRows,
  setPrelicenseRows,
  setForeignRows,
  defaultIntyg,
  onClose,
}: Props) {
  if (!picker.open || !picker.mode) return null;

  return (
    <BtMilestonePicker
      open
      title="Välj BT-delmål"
      checked={new Set(
        (picker.mode === "prelicense" ? prelicenseRows : foreignRows)
          .find((x) => x.id === picker.rowId)
          ?.intyg?.goals?.map((g) => g.id) ?? []
      )}
      onToggle={(id: string) => {
        const setRows = picker.mode === "prelicense" ? setPrelicenseRows : setForeignRows;

        setRows((rows) =>
          rows.map((x) => {
            if (x.id !== picker.rowId) return x;

            const existing = (x.intyg?.goals ?? []).map((g) => ({ ...g }));
            const has = existing.some((g) => g.id === id);
            const nextGoals = has
              ? existing.filter((g) => g.id !== id)
              : [...existing, { id, label: id }];

            return {
              ...x,
              intyg: {
                ...(x.intyg ?? defaultIntyg()),
                goals: nextGoals,
              },
            };
          })
        );
      }}
      onClose={onClose}
    />
  );
}
