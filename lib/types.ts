// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export type GoalsVersion = "2015" | "2021";

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


export type ActivityComment = {
  id: string;
  author: string;             // Namn på den som kommenterar
  role?: string;              // t.ex. "handledare", "studierektor"
  text: string;
  createdAt: string;          // ISO
};

export type Attestation = {
  attestedBy: string;         // Namn på den som attesterar
  attestedRole?: string;      // t.ex. "handledare", "studierektor"
  attestedAt: string;         // ISO
  revoked?: boolean;
  revokedAt?: string;         // ISO
  revokedBy?: string;
};

export type Placement = {
  id: string;
  clinic: string;             // Placering/arbete
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  attendance: number;         // Sysselsättningsgrad (%)
  supervisor?: string;
  note?: string;
  attestation?: Attestation;
  comments?: ActivityComment[];
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

  attestation?: Attestation;
  comments?: ActivityComment[];
};


export type Achievement = {
  id: string;
  placementId?: string;
  courseId?: string;
  milestoneId: string;        // Goals.milestones[].id
  date: string;               // kopplings-/intygsdatum
};
