export type NetworkShareMode = "open" | "group" | "request";
export type NetworkDataScope = "activities" | "iup_headers";
export type ContactField = "email" | "mobile" | "phone_work";
export type NetworkGroupTab = "group" | "admin";
export type NetworkInviteMode = "hospital" | "vardcentral";

export type NetworkClinic = {
  id: string;
  name: string;
  region: string;
  hospitalName: string;
  facilityType: string;
};

export type NetworkGroup = {
  id: string;
  name: string;
  clinicIds: string[];
  adminUserIds: string[];
  memberUserIds: string[];
};

export type NetworkParticipant = {
  userId: string;
  name: string;
  clinicId: string;
  clinicName: string;
  region: string;
  hospitalName: string;
  facilityType: string;
  email: string;
  mobile: string;
  phoneWork: string;
};

export type NetworkClinicRegionContext = {
  regionLabel: string;
  peerClinicCount: number | null;
};

export type NetworkSrProfile = {
  name: string;
  email: string;
  mobile: string;
  phone_work: string;
};

export type NetworkClinicOption = {
  clinicId: string;
  clinicName: string;
};
