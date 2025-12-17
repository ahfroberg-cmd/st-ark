// lib/db.ts
//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
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

  // Centralt sparad data för Specialistansökan (PrepareApplicationModal)
  specialistApplication!: Table<any, string>;

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

    // Version 6: lägger till tabell för Specialistansökan
    this.version(6).stores({
      profile: "id",
      placements: "id,startDate,endDate",
      courses: "id,certificateDate",
      achievements: "id,milestoneId,courseId,placementId",
      timeline: "id",
      iupMilestonePlans: "id,milestoneId,profileId",
      specialistApplication: "id",
    });

    this.profile = this.table("profile");
    this.placements = this.table("placements");
    this.courses = this.table("courses");
    this.achievements = this.table("achievements");
    this.timeline = this.table("timeline");
    this.iupMilestonePlans = this.table("iupMilestonePlans");
    this.specialistApplication = this.table("specialistApplication");
  }
}


export const db = new AppDB();
