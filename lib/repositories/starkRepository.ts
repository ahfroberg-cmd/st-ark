import { supabase } from "@/lib/supabase";
import {
  ACHIEVEMENT_COLUMNS,
  ACHIEVEMENT_COLUMNS_FALLBACK,
  COURSE_COLUMNS,
  IUP_SETTINGS_COLUMNS,
  PLACEMENT_COLUMNS,
  PROFILE_COLUMNS,
} from "./starkRepository.columns";
export {
  ACHIEVEMENT_COLUMNS,
  CLINIC_ACTIVITY_TEMPLATE_COLUMNS,
  COURSE_COLUMNS,
  IUP_SETTINGS_COLUMNS,
  PLACEMENT_COLUMNS,
  PROFILE_COLUMNS,
  PROFILE_EDITOR_COLUMNS,
} from "./starkRepository.columns";
export {
  fetchProfileById,
  fetchProfileForEditor,
  fetchProfileNameById,
  fetchProfileRedirectInfoById,
  fetchProfileRoleById,
  fetchProfileSrContactFields,
  getAuthenticatedUserId,
  getClinicIdForCurrentUserRole,
  getCurrentUserRole,
  updateProfileSnakeCase,
  upsertProfile,
  upsertProfilePayload,
} from "./starkRepository.profiles";
export {
  deleteAchievementForUser,
  deleteAchievementsByUserAndCourse,
  deleteAchievementsByUserAndPlacement,
  fetchIupAssessmentsOnly,
  fetchIupDirectorMeetingsOnly,
  fetchIupMeetingsByUserId,
  fetchIupSettingsIdAndMeetingsByUserId,
  fetchIupSettingsRowByUserId,
  getIupInstrumentsForUser,
  insertAchievementRows,
  insertIupSettingsRow,
  listAchievementsByUserId,
  saveAchievementForUser,
  updateIupSettingsMeetingsByRowId,
  upsertIupSettingsOnUserId,
} from "./starkRepository.achievementsIup";
export {
  deleteClinicActivityTemplateById,
  deleteClinicMetisTemplatesByClinicId,
  fetchClinicActivityTemplateSuggestedRowsByTitle,
  getClinicActivityTemplateById,
  insertClinicActivityTemplates,
  listActiveClinicActivityTemplatesByClinicId,
  listClinicActivityTemplatesByClinicId,
  saveClinicActivityTemplate,
  saveClinicActivityTemplateConfig,
  updateClinicActivityTemplateById,
} from "./starkRepository.clinicTemplates";
export {
  acknowledgeActivityTemplateChangeNotification,
  deleteSrActivitySuggestionById,
  deleteSrMessageById,
  dismissSrMessageById,
  dismissSrMessageLooseById,
  fetchClinicMembershipForUser,
  insertSrActivitySuggestions,
  insertSrMessages,
  insertSrMessagesSelect,
  listHandledSentSuggestions,
  listIncomingMessagesForUser,
  listIncomingSuggestionsForUser,
  listPendingActivityTemplateChangeNotifications,
  listPendingIncomingMessagesOldestFirst,
  listPendingSentSuggestions,
  listPendingSuggestionsOldestFirst,
  listReadSentMessages,
  listSentMessagesByPair,
  listSentMessagesForUser,
  listSentSuggestionsByPair,
  listSrMessagesBetweenUsers,
  listSrSuggestionsBetweenUsers,
  listUnreadSentMessages,
  markSrMessageReadById,
  respondSrSuggestionById,
  updateSrSuggestionStatusById,
} from "./starkRepository.srMessaging";
export {
  deleteClinicMembershipRow,
  deleteClinicRow,
  deleteHospitalRow,
  insertClinicMembershipRow,
  insertClinicRow,
  insertHospitalRow,
  listClinicMembershipsWithProfiles,
  listClinicsForAdmin,
  listHospitalsForAdmin,
  listProfilesForAdminPicker,
  syncStandardHospitalsMissing,
  updateClinicRowForAdmin,
  updateHospitalRow,
} from "./starkRepository.admin";
export {
  findClinicMembershipIdForUserClinic,
  findInvitationIdByEmailAndClinic,
  getInvitationEmailByToken,
  getInvitationWithClinicByToken,
  getProfileIdRoleByUserId,
  insertInvitationRow,
  insertProfileIdRole,
  listClinicsBrief,
  listInvitationsAll,
  listInvitationsByInviter,
  listPendingInvitationsForEmails,
  listStudierektorClinicRows,
  markInvitationAccepted,
  reassignClinicMembersToOtherClinic,
  updateInvitationStatus,
  updateProfileNameForUser,
  updateProfileRoleForUser,
} from "./starkRepository.invitationsMembership";
export {
  createSupervisorAssignment,
  fetchFirstClinicMembershipWithClinicForUser,
  fetchSupervisorIdForStAtClinic,
  listClinicMembershipsByClinicId,
  listProfilesByIds,
  listSupervisorAssignedStudentIds,
  listSupervisorAssignments,
  listSupervisorAssignmentsByClinicId,
  listSupervisorIdsForStLakare,
  deleteSupervisorAssignmentsForStudent,
} from "./starkRepository.supervisorClinic";
export {
  clearPlacementLabelsByIds,
  deleteCoursesForUserByIds,
  deletePlacementsForUserByIds,
  fetchClinicNameById,
  getClinicChiefVerificationRow,
  getClinicFormRow,
  insertActivityDocumentRow,
  insertActivityTemplateChangeNotifications,
  insertTimelineVersionRow,
  listActivityDocumentsForUser,
  listActivityDocumentsWithPathForUser,
  listCoursesBriefForDocumentsPicker,
  listCoursesColleagueDescriptionsForUserIds,
  listCoursesForTemplateScanByUserIds,
  listCourseTitlesByUserIdForSuggest,
  listPlacementsBriefForDocumentsPicker,
  listPlacementsColleagueDescriptionsForUserIds,
  listPlacementsForSuggestByUserId,
  listPlacementsForTemplateScanByUserIds,
  listRecentTimelineVersionsForUser,
  renameCoursesTitleByIds,
  renamePlacementsClinicTitleByIds,
  resetCoursesTitleByIds,
  updateActivityDocumentLink,
  updateClinicChiefFields,
} from "./starkRepository.timelineSupport";
export {
  deleteCourseForUser,
  deletePlacementForUser,
  insertCourseRowForUser,
  insertPlacementRowForUser,
  listCoursesByUserId,
  listPlacementsByUserId,
  saveCourseForUser,
  savePlacementForUser,
} from "./starkRepository.timelineEntities";

export async function listStudentPackByIds(userIds: string[]) {
  const achievementsPromise = (async () => {
    let res: any = await supabase
      .from("achievements")
      .select(ACHIEVEMENT_COLUMNS)
      .in("user_id", userIds);
    if (res.error) {
      res = await supabase
        .from("achievements")
        .select(ACHIEVEMENT_COLUMNS_FALLBACK)
        .in("user_id", userIds);
    }
    return res;
  })();
  return Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", userIds),
    supabase.from("placements").select(PLACEMENT_COLUMNS).in("user_id", userIds),
    supabase.from("courses").select(COURSE_COLUMNS).in("user_id", userIds),
    achievementsPromise,
    supabase
      .from("timeline_versions")
      .select("id,user_id,created_at,version_data")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabase.from("milestone_plans").select("id,user_id,milestone_id,plan_text,updated_at").in("user_id", userIds),
    supabase.from("iup_settings").select(IUP_SETTINGS_COLUMNS).in("user_id", userIds),
  ]);
}

