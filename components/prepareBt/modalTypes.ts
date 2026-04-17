import type { Placement } from "@/lib/types";

export type Props = { open: boolean; onClose: () => void };

export type BtGoalId = string;
export type Chip = { id: BtGoalId; label: string };

export type BtActivity = {
  id: string;
  text: string;
  startISO: string | null;
  endISO: string | null;
  source?: "manual" | "registered";
  refId?: string;
};

export type BtPlacementRow = {
  id: string;
  ref: Placement;
  primaryCare: boolean;
  acuteCare: boolean;
  percent: number;
  monthsFte: number;
};

export type ForeignOrPrelicenseRow = {
  id: string;
  title: string;
  intyg?: {
    clinic: string;
    startISO: string | null;
    endISO: string | null;
    percent: number;
    supervisor: string;
    supervisorSpec: string;
    supervisorWorkplace: string;
    controlHow: string;
    goals: Chip[];
  };
};

export type AttachKey =
  | "Delmål i bastjänstgöringen"
  | "Fullgjord bastjänstgöring"
  | "Uppnådd baskompetens"
  | "Tjänstgöring före legitimation"
  | "Utländsk tjänstgöring";
