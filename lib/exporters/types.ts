// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export type GoalsVersion = "2015" | "2021";
export type ActivityType =
  | "PLACERING"
  | "AUSKULTATION"
  | "SKRIFTLIGT_ARBETE"
  | "KVALITETSARBETE"
  | "KURS"
  // === BT (2021) ===
  | "BT_GOALS"
  | "BT_FULLGJORD"
  | "BT_KOMPETENS"
  | "BT_ANSOKAN";


export type Profile = {
  name?: string;
  personalNumber?: string;
  speciality?: string; // stavning 1
  specialty?: string;  // stavning 2 (fallback)
  goalsVersion?: GoalsVersion;
  startDate?: string;
  firstName?: string;
  lastName?: string;
  homeClinic?: string;

  // Huvudhandledare (från profilsidan)
  supervisor?: string;              // HH namn  (mappas från form.supervisor)
  supervisorWorkplace?: string;     // HH tjänsteställe (om "Har annat tjänsteställe" är ikryssad)
};


export type Placement = {
  title?: string;
  site?: string;                // tjänstgöringsställe
  startDate: string;
  endDate: string;
  attendance?: number;

  // Handledare
  supervisor?: string;
  supervisorPn?: string;
  supervisorSpeciality?: string;
  supervisorSpecialty?: string; // fallback
  supervisorSite?: string;

  // Kursledare (NYTT – används på 2015 Kurs-intyg oavsett vem som signerar)
  courseLeaderName?: string;
  courseLeaderSpeciality?: string;
  courseLeaderSite?: string;

  cityDate?: string;
  bilagaNr?: string | number;
  notes?: string;               // beskrivning
  clinic?: string;              // UI-fält som ofta motsvarar title

  // Popup “förbered intyg” kan lägga signer här (behålls som any i koden)
  // signer?: { type: "KURSLEDARE"|"HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string };
};


export type ExportInput = {
  goalsVersion: GoalsVersion;
  activityType: ActivityType;
  profile: Profile;
  activity: Placement;
  milestones?: string[];
};
