export const PROFILE_COLUMNS =
  "id,name,email,role,specialty,sr_for_specialty,goals_version,st_start_date,bt_start_date,bt_end_date,st_end_iso,st_total_months,mobile,phone_home,phone_work,address,postal_code,city,personal_number,supervisor,supervisor_workplace,home_clinic,locked,secondary_email,other_information,updated_at,created_at";

/** Utökad profil för modal/profilsida (undvik select *). */
export const PROFILE_EDITOR_EXTRA_COLUMNS =
  "share_colleague_education,share_colleague_contact,study_director,study_director_workplace,manager,verksamhetschef,med_degree_country,med_degree_date,license_country,license_date,has_foreign_license,foreign_licenses,has_prior_specialist,prior_specialties,is_third_country_specialist,bt_mode,sr_specialty";

export const PROFILE_EDITOR_COLUMNS = `${PROFILE_COLUMNS},${PROFILE_EDITOR_EXTRA_COLUMNS}`;

export const PLACEMENT_COLUMNS =
  "id,user_id,type,clinic,title,start_date,end_date,attendance,supervisor,supervisor_specialty,supervisor_site,note,bt_assessment,bt_milestones,milestones,fulfills_st_goals,phase,show_on_timeline,intyg_group,intyg_group_config,updated_at,created_at";

export const COURSE_COLUMNS =
  "id,user_id,title,kind,city,course_leader_name,start_date,end_date,certificate_date,note,course_title,bt_assessment,bt_milestones,milestones,fulfills_st_goals,phase,show_as_interval,show_on_timeline,updated_at,created_at";

export const ACHIEVEMENT_COLUMNS =
  "id,user_id,placement_id,course_id,milestone_id,goal_id,code,milestone,date,achieved_date,note,updated_at,created_at";

export const ACHIEVEMENT_COLUMNS_FALLBACK =
  "id,user_id,placement_id,course_id,milestone_id,achieved_date,note,updated_at,created_at";

export const IUP_SETTINGS_COLUMNS =
  "id,user_id,planning,planning_extra,planning_hidden,meetings,director_meetings,specialist_collegiums,assessments,instruments,show_meetings_on_timeline,show_assessments_on_timeline,show_director_meetings_on_timeline,show_specialist_collegiums_on_timeline,updated_at,created_at";

export const CLINIC_ACTIVITY_TEMPLATE_COLUMNS =
  "id,clinic_id,type,title,description,track_completions,suggested_milestones,suggested_rows,is_active,updated_at,created_at";

export const CLINIC_ACTIVITY_TEMPLATE_COLUMNS_FALLBACK =
  "id,clinic_id,type,title,description,suggested_milestones,suggested_rows,is_active,updated_at,created_at";
