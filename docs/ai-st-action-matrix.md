# AI ST Action Matrix

This matrix maps concrete ST-doctor UI operations in `PusslaDinST` to agent actions.
It is used to keep action coverage aligned with human workflows.

## Timeline Operations

| Human operation | Agent action |
| --- | --- |
| Create placement by dates | `create_placement_from_range` |
| Create typed placement by dates | `create_typed_placement_from_range` |
| Create course by dates | `create_course_from_range` |
| Create typed course by dates | `create_typed_course_from_range` |
| Select placement | `select_placement` |
| Select course | `select_course` |
| Update selected placement core fields | `update_selected_placement` |
| Update selected course core fields | `update_selected_course` |
| Save selected placement | `save_selected_placement` |
| Save selected course | `save_selected_course` |
| Extend last placement | `extend_last_placement` |
| Shift placement from end | `shift_placement_from_end` |
| Shift all courses in time | `shift_all_courses` |
| Rebalance courses per half-year | `rebalance_courses_per_half_year` |
| Generic distribution planning (frequency/cadence) | `plan_timeline_distribution` |
| Delete currently selected placement | `delete_selected_placement` |
| Delete currently selected course | `delete_selected_course` |
| Delete placement by month/year | `delete_placement_by_month_year` |
| Delete course by month/year | `delete_course_by_month_year` |
| Convert course to utbildningsmoment | `convert_course_to_utbildningsmoment` |

## Milestone and Goal Mapping

| Human operation | Agent action/field |
| --- | --- |
| Set ST milestones on selected placement | `update_selected_placement.fields.milestones` |
| Set BT milestones on selected placement | `update_selected_placement.fields.btMilestones` |
| Set leave subtype on selected placement | `update_selected_placement.fields.leaveSubtype` |
| Set ST milestones on selected course | `update_selected_course.fields.milestones` |
| Set BT milestones on selected course | `update_selected_course.fields.btMilestones` |

## Planning Operations

| Human operation | Agent action |
| --- | --- |
| Build ST from SR templates | `plan_st_from_sr_templates` |
| Build METIS plan covering course milestones | `plan_courses_cover_course_milestones` |
| Synka delmål på alla kurser | `sync_course_milestones` |

## Read and Analysis Operations

| Human operation | Agent action |
| --- | --- |
| Review all milestone info pages | `summarize_goal_catalog` |
| Read broad app section state | `summarize_app_sections` |
| Review role view coverage (ST/SR/HH) | `summarize_role_views` |
| Summarize colleague placement notes | `summarize_colleague_placements` |
| Summarize colleague course notes | `summarize_colleague_courses` |

## IUP handledarsamtal / huvudhandledarsamtal

Synonymer i språk och prompt: **handledarsamtal**, **huvudhandledarsamtal**, **handledarträff** (samma mötestyp som `add_iup_followup` med `followupType: "meeting"`).

| Human operation | Agent action |
| --- | --- |
| Lägg till ett datum | `add_iup_followup` (`followupType: "meeting"`) |
| Lägg till flera datum på en gång | `add_iup_supervision_meetings` (`dateISOs`, max 15 per körning) |
| Flytta alla möten lika många dagar | `shift_iup_supervision_meetings` (`days`, t.ex. 7 = en vecka) |
| Ta bort möten på angivna datum | `remove_iup_supervision_meetings_by_dates` (`dateISOs`) |
| Rensa alla handledningstillfällen / bedömningar | `clear_iup_followups` |

## Navigation and UI Controls

| Human operation | Agent action |
| --- | --- |
| Open app modal/window | `open_window` |
| Close app modal/window | `close_window` |
| Switch IUP tab | `set_iup_tab` |
| Switch lane (placement/course) | `navigate_lane` |
