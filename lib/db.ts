// lib/db.ts
import Dexie, { Table } from "dexie";
import type { Profile, Placement, Course, Achievement } from "./types";

export class AppDB extends Dexie {
  profile!: Table<Profile, string>;
  placements!: Table<Placement, string>;
  courses!: Table<Course, string>;
  achievements!: Table<Achievement, string>;

  // Ny tabell för tidslinje-draft + UI-inställningar (PusslaDinST)
  timeline!: Table<any, string>;

  // Centralt sparade planer för delmål i IUP (per profil + delmål)
  iupMilestonePlans!: Table<any, string>;

  constructor() {
    // OBS: Namnbytet från "st-intyg" till "st-ark" innebär ny IndexedDB-databas
    // och därmed tom lokal data första gången i varje webbläsare.
    super("st-ark");


    this.version(1).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId",
    });

    this.version(2).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId,courseId,placementId",
    });

    this.version(3).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId,courseId,placementId",
    });

    // Version 4: samma tabeller som v3 + ny "timeline"-store
    this.version(4).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId,courseId,placementId",
      timeline: "id",
    });

    // Version 5: lägger till tabell för IUP-delmålsplaner
    this.version(5).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId,courseId,placementId",
      timeline: "id",
      iupMilestonePlans: "id,milestoneId,profileId",
    });

    this.profile = this.table("profile");
    this.placements = this.table("placements");
    this.courses = this.table("courses");
    this.achievements = this.table("achievements");
    this.timeline = this.table("timeline");
    this.iupMilestonePlans = this.table("iupMilestonePlans");
  }
}


export const db = new AppDB();
