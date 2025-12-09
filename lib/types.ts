// lib/types.ts

export type Profile = {
  name?: string;
  personalNumber?: string;
  speciality?: string;
  specialty?: string;
  goalsVersion?: GoalsVersion;
  startDate?: string;
  firstName?: string;
  lastName?: string;
  homeClinic?: string;
  locked?: boolean;

  /** Tillåt historiska namn (vid giftermål etc.) för intygsvalidering */
  previousNames?: string[]; // ex: ["Anna Andersson", "Anna Karlsson"]
};


export type Placement = {
  id: string;
  clinic: string;             // Placering/arbete
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  attendance: number;         // Sysselsättningsgrad (%)
  supervisor?: string;
  note?: string;
};

export type Course = {
  id: string;
  title: string;
  city: string;
  certificateDate: string;    // YYYY-MM-DD
  note?: string;

  // Handledaruppgifter (för kursintyg m.m.)
  supervisorName?: string;
  supervisorSite?: string;
  supervisorSpeciality?: string;
  supervisorPersonalNumber?: string;
  supervisorSource?: "PROFILE" | "CUSTOM";

  // Kursledaruppgifter (kursintyg 2021 m.m.)
  courseLeaderName?: string;
  courseLeaderSite?: string;
  courseLeaderSpeciality?: string;
};


export type Achievement = {
  id: string;
  placementId?: string;
  courseId?: string;
  milestoneId: string;        // Goals.milestones[].id
  date: string;               // kopplings-/intygsdatum
};
