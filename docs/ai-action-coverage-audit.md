# AI Action Coverage Audit

This document tracks manual app maneuvers versus AI action coverage.

## Covered Baseline Maneuvers

- Timeline lane navigation and modal open/close (`navigate_lane`, `open_window`, `close_window`)
- Placement CRUD on timeline (`create_*placement*`, `select_placement`, `update_selected_placement`, `save_selected_placement`)
- Course CRUD on timeline (`create_*course*`, `select_course`, `update_selected_course`, `save_selected_course`)
- Bulk timeline changes (`extend_last_placement`, `shift_placement_from_end`, `shift_all_courses`, `plan_timeline_distribution`)
- Goal-oriented planning (`plan_st_from_sr_templates`, `plan_courses_cover_course_milestones`, `sync_course_milestones`)
- Scoped deletes by time (`delete_placement_by_month_year`, `delete_course_by_month_year`)
- Selected-item deletes (`delete_selected_placement`, `delete_selected_course`)
- Read/summarize actions (`summarize_goal_catalog`, `summarize_app_sections`, `summarize_role_views`, colleague summaries)

## Newly Added In This Pass

- `delete_selected_placement`
- `delete_selected_course`
- Local parser support for selected deletes (e.g. "ta bort vald kurs")
- Action-policy and executor integration for both actions

## High-Priority Gaps (Next Actions)

- IUP content editing actions (meetings, assessments, planning sections, settings save)
- Profile field updates (except blocked contact information)
- Hemklinik messaging actions (create/read/respond/suggestion handling)
- Report filtering and print/export actions
- Scan-certificate workflow actions (upload/parse/review/save)
- Studierektor dashboard actions (invite, template CRUD, send suggestions)
- Handledare dashboard actions (meeting comments, suggestions)

## Privacy Guardrail

Contact information is intentionally blocked in execution flow. The AI agent may reason about app state but must not write personal contact details.
