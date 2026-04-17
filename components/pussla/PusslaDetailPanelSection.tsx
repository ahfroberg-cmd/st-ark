"use client";

import PlacementDetailHeaderFields from "@/components/pussla/PlacementDetailHeaderFields";
import PlacementNoteSuggestionsPopup from "@/components/pussla/PlacementNoteSuggestionsPopup";
import PlacementDetailFooter from "@/components/pussla/PlacementDetailFooter";
import CourseDetailHeaderFields from "@/components/pussla/CourseDetailHeaderFields";
import CourseAddToPlacementSection from "@/components/pussla/CourseAddToPlacementSection";
import CourseDescriptionSection from "@/components/pussla/CourseDescriptionSection";
import CourseDetailFooter from "@/components/pussla/CourseDetailFooter";
import { getActivityEndISO, getActivityStartISO } from "@/lib/pussla/activityDateRange";
import { getPlacementDetailGridClass, getPlacementDetailGridStyle } from "@/lib/pussla/placementDetailGrid";
import { buildPlacementNoteSuggestionsContext } from "@/lib/pussla/placementNoteSuggestions";

export default function PusslaDetailPanelSection(props: {
  selectedPlacement: any;
  selectedCourse: any;
  profile: any;
  startYear: number;
  isValidISO: any;
  slotToYearMonthHalf: any;
  mondayNearestTo: any;
  dateToISO: any;
  sundayBeforeAnchor: any;
  normalizeGoalsVersion: any;
  isoToDateSafe: any;
  addMonths: any;
  dateToSlot: any;
  srPlacementTemplates: any;
  placementGroupsOrder: any;
  getCourseTemplateGroup: any;
  sanitizeStMilestonesForGoals: any;
  getTemplateSuggestedPeriodMonths: any;
  nearestSundayISO: any;
  shiftIsoDays: any;
  roundToAnchors: any;
  setPlacementPeriodSuggestionDialog: any;
  applyPlacementDates: any;
  isLeave: any;
  updatePlacementSupervisor: any;
  updatePlacementSupervisorSpeciality: any;
  updatePlacementSupervisorSite: any;
  updatePlacementNote: any;
  updatePlacementBtAssessment: any;
  colleaguePlacementDescriptions: any;
  splitTemplateSuggestedRows: any;
  placementNameMatches: any;
  forslagPopupFor: any;
  forslagTab: any;
  setForslagTab: any;
  closePlacementSuggestions: any;
  appendPlacementStudierektorRow: any;
  appendPlacementColleagueDescription: any;
  colleagueFormatDate: any;
  togglePlacementSuggestions: any;
  dirty: boolean;
  setActivities: any;
  setBtMilestonePicker: any;
  setMilestonePicker: any;
  sortMilestoneIds: any;
  displayMilestoneCode: any;
  setBtMilestoneDetail: any;
  setStMilestoneDetail: any;
  savePlacementToDb: any;
  closeDetailPanel: any;
  requestDeletePlacement: any;
  setIntygGroupModalOpen: any;
  setCourses: any;
  setDirty: any;
  updateSelectedCourse: any;
  usesMetisCourses: any;
  srUtbildningsmomentTemplates: any;
  srCourseTemplates: any;
  courseGroupsOrder: any;
  mapMetisGoalsToMilestoneIds: any;
  getMetisCoursesForSpecialty: any;
  getEffectiveBtWindow: any;
  isPlacementInBtWindow: any;
  isIsoInBtWindow: any;
  activities: any[];
  courses: any[];
  getCourseDisplayTitle: any;
  resolveMatchingUtbildningsmoment: any;
  buildUpdatedPlacementNote: any;
  hemklinikSuggestions: any;
  setForslagPopupFor: any;
  saveCourseToDb: any;
  requestDeleteCourse: any;
}) {
  if (!props.selectedPlacement && !props.selectedCourse) return null;

  const selAct = props.selectedPlacement;
  const selCourse = props.selectedCourse;
  const isCourse = !!selCourse && !selAct;
  const isPlacement = !!selAct && !selCourse;

  const actStartISO = selAct
    ? getActivityStartISO({
        activity: selAct as any,
        startYear: props.startYear,
        isValidISO: props.isValidISO,
        slotToYearMonthHalf: props.slotToYearMonthHalf,
        mondayNearestTo: props.mondayNearestTo,
        dateToISO: props.dateToISO,
      })
    : "";
  const actEndISO = selAct
    ? getActivityEndISO({
        activity: selAct as any,
        startYear: props.startYear,
        isValidISO: props.isValidISO,
        slotToYearMonthHalf: props.slotToYearMonthHalf,
        sundayBeforeAnchor: props.sundayBeforeAnchor,
        dateToISO: props.dateToISO,
      })
    : "";

  return (
    <div
      className="relative rounded-xl border-2 bg-white p-4 border-sky-600 ring-1 ring-sky-600 mb-6"
      style={{
        boxShadow: (() => {
          const isCoursePanel = !!selCourse && !selAct;
          if (isCoursePanel) return "none";
          const hue = selAct?.hue ?? 210;
          return `inset 0 0 0 4px hsl(${hue} 30% 72%)`;
        })(),
      }}
    >
      {isPlacement && selAct && (
        <>
          <div
            className={[
              "grid gap-3 grid-cols-1",
              getPlacementDetailGridClass(selAct as any, (props.profile || {}) as any, props.startYear, {
                normalizeGoalsVersion: props.normalizeGoalsVersion,
                isValidISO: props.isValidISO,
                isoToDateSafe: props.isoToDateSafe,
                dateToISO: props.dateToISO,
                addMonths: props.addMonths,
                dateToSlot: props.dateToSlot,
              }),
              selAct?.type === "Forskning" && "md:grid-cols-3",
            ].join(" ")}
            style={getPlacementDetailGridStyle(
              selAct as any,
              (props.profile || {}) as any,
              props.startYear,
              props.srPlacementTemplates as any,
              {
                normalizeGoalsVersion: props.normalizeGoalsVersion,
                isValidISO: props.isValidISO,
                isoToDateSafe: props.isoToDateSafe,
                dateToISO: props.dateToISO,
                addMonths: props.addMonths,
                dateToSlot: props.dateToSlot,
              }
            )}
          >
            <PlacementDetailHeaderFields
              selAct={selAct}
              selectedPlacement={selAct}
              profile={props.profile}
              activities={props.activities}
              startYear={props.startYear}
              actStartISO={actStartISO}
              actEndISO={actEndISO}
              isLeave={props.isLeave}
              isValidISO={props.isValidISO}
              isoToDateSafe={props.isoToDateSafe}
              dateToISO={props.dateToISO}
              addMonths={props.addMonths}
              getEffectiveBtWindow={props.getEffectiveBtWindow}
              isPlacementInBtWindow={props.isPlacementInBtWindow}
              dateToSlot={props.dateToSlot}
              setActivities={props.setActivities}
              srPlacementTemplates={props.srPlacementTemplates}
              placementGroupsOrder={props.placementGroupsOrder}
              getCourseTemplateGroup={props.getCourseTemplateGroup}
              sanitizeStMilestonesForGoals={props.sanitizeStMilestonesForGoals}
              getTemplateSuggestedPeriodMonths={props.getTemplateSuggestedPeriodMonths}
              slotToYearMonthHalf={props.slotToYearMonthHalf}
              mondayNearestTo={props.mondayNearestTo}
              nearestSundayISO={props.nearestSundayISO}
              shiftIsoDays={props.shiftIsoDays}
              roundToAnchors={props.roundToAnchors}
              setPlacementPeriodSuggestionDialog={props.setPlacementPeriodSuggestionDialog}
              applyPlacementDates={props.applyPlacementDates}
            />
          </div>

          {!props.isLeave(selAct.type) && selAct.type !== "Forskning" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-700">Handledare</label>
                <input
                  value={selAct.supervisor || ""}
                  onChange={(e) => props.updatePlacementSupervisor(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700">Handledares specialitet</label>
                <input
                  value={selAct.supervisorSpeciality || ""}
                  onChange={(e) => props.updatePlacementSupervisorSpeciality(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700">Handledares tjänsteställe</label>
                <input
                  value={selAct.supervisorSite || ""}
                  onChange={(e) => props.updatePlacementSupervisorSite(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          )}

          <div>
            {selAct?.phase === "BT" && selAct.type === "Klinisk tjänstgöring" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-700">Beskrivning</label>
                  <textarea
                    value={String((selAct as any)?.note || "")}
                    onChange={(e) => props.updatePlacementNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-700">
                    Hur det kontrollerats att sökanden uppnått delmål (för intyg Delmål i BT)
                  </label>
                  <textarea
                    value={String((selAct as any)?.btAssessment || "")}
                    onChange={(e) => props.updatePlacementBtAssessment(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
                  />
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const { isNoteType, groupedRows, colleagueRows, hasSuggestionSources } =
                    buildPlacementNoteSuggestionsContext({
                      activityType: selAct.type,
                      activityLabel: selAct.label,
                      srPlacementTemplates: props.srPlacementTemplates as any,
                      colleaguePlacementDescriptions: props.colleaguePlacementDescriptions as any,
                      isLeave: props.isLeave,
                      splitTemplateSuggestedRows: props.splitTemplateSuggestedRows,
                      placementNameMatches: (inputName, candidateName, candidateNameAlt) =>
                        props.placementNameMatches(
                          inputName,
                          String(candidateName || ""),
                          candidateNameAlt ?? undefined
                        ),
                    });
                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-sm text-slate-700">
                          {isNoteType ? "Beskrivning (dubbelklicka i rutan för förslag)" : "Notering"}
                        </label>
                        {hasSuggestionSources && (
                          <PlacementNoteSuggestionsPopup
                            open={props.forslagPopupFor === "placement"}
                            tab={props.forslagTab}
                            onTabChange={props.setForslagTab}
                            onClose={props.closePlacementSuggestions}
                            groupedRows={groupedRows}
                            colleagueRows={colleagueRows.map((row) => ({
                              description: row.description,
                              colleagueName: row.colleagueName,
                              startDate: row.startDate,
                              endDate: row.endDate,
                            }))}
                            onSelectStudierektorRow={props.appendPlacementStudierektorRow}
                            onSelectColleagueDescription={props.appendPlacementColleagueDescription}
                            formatDate={props.colleagueFormatDate}
                          />
                        )}
                      </div>
                      <textarea
                        data-note-editor="true"
                        value={selAct.note || ""}
                        onChange={(e) => props.updatePlacementNote(e.target.value)}
                        onDoubleClick={() => props.togglePlacementSuggestions(hasSuggestionSources)}
                        className="min-h-[120px] w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
                      />
                    </>
                  );
                })()}
              </>
            )}

            <PlacementDetailFooter
              selAct={selAct}
              selectedPlacement={selAct}
              profile={props.profile}
              dirty={props.dirty}
              isLeave={props.isLeave}
              setActivities={props.setActivities}
              setBtMilestonePicker={props.setBtMilestonePicker}
              setMilestonePicker={props.setMilestonePicker}
              sortMilestoneIds={props.sortMilestoneIds}
              displayMilestoneCode={props.displayMilestoneCode}
              setBtMilestoneDetail={props.setBtMilestoneDetail}
              setStMilestoneDetail={props.setStMilestoneDetail}
              savePlacementToDb={props.savePlacementToDb}
              closeDetailPanel={props.closeDetailPanel}
              requestDeletePlacement={props.requestDeletePlacement}
              onOpenIntygGroup={
                !props.isLeave(selAct.type) && selAct.type !== "Forskning"
                  ? () => props.setIntygGroupModalOpen(true)
                  : undefined
              }
            />
          </div>
        </>
      )}

      {isCourse && selCourse && (
        <div className="grid gap-3">
          <CourseDetailHeaderFields
            selCourse={selCourse}
            profile={props.profile}
            setCourses={props.setCourses}
            setDirty={props.setDirty}
            updateSelectedCourse={props.updateSelectedCourse}
            usesMetisCourses={props.usesMetisCourses}
            srUtbildningsmomentTemplates={props.srUtbildningsmomentTemplates}
            sanitizeStMilestonesForGoals={props.sanitizeStMilestonesForGoals}
            srCourseTemplates={props.srCourseTemplates}
            courseGroupsOrder={props.courseGroupsOrder}
            getCourseTemplateGroup={props.getCourseTemplateGroup}
            mapMetisGoalsToMilestoneIds={props.mapMetisGoalsToMilestoneIds}
            getMetisCoursesForSpecialty={props.getMetisCoursesForSpecialty}
            getEffectiveBtWindow={props.getEffectiveBtWindow}
            isIsoInBtWindow={props.isIsoInBtWindow}
            isValidISO={props.isValidISO}
            isoToDateSafe={props.isoToDateSafe}
            dateToISO={props.dateToISO}
            addMonths={props.addMonths}
          />

          <CourseAddToPlacementSection
            selCourse={selCourse}
            profile={props.profile}
            activities={props.activities}
            courses={props.courses}
            startYear={props.startYear}
            setCourses={props.setCourses}
            setActivities={props.setActivities}
            setDirty={props.setDirty}
            isValidISO={props.isValidISO}
            dateToSlot={props.dateToSlot}
            getCourseDisplayTitle={props.getCourseDisplayTitle}
            resolveMatchingUtbildningsmoment={props.resolveMatchingUtbildningsmoment}
            buildUpdatedPlacementNote={props.buildUpdatedPlacementNote}
            sanitizeStMilestonesForGoals={props.sanitizeStMilestonesForGoals}
            srUtbildningsmomentTemplates={props.srUtbildningsmomentTemplates}
          />

          <CourseDescriptionSection
            selCourse={selCourse}
            selectedCourse={selCourse}
            setCourses={props.setCourses}
            getCourseDisplayTitle={props.getCourseDisplayTitle}
            srUtbildningsmomentTemplates={props.srUtbildningsmomentTemplates}
            srCourseTemplates={props.srCourseTemplates}
            hemklinikSuggestions={props.hemklinikSuggestions}
            forslagPopupFor={props.forslagPopupFor}
            setForslagPopupFor={props.setForslagPopupFor}
            forslagTab={props.forslagTab}
            setForslagTab={props.setForslagTab}
          />

          <CourseDetailFooter
            selectedCourse={selCourse}
            profile={props.profile}
            dirty={props.dirty}
            setCourses={props.setCourses}
            setBtMilestonePicker={props.setBtMilestonePicker}
            setMilestonePicker={props.setMilestonePicker}
            sortMilestoneIds={props.sortMilestoneIds}
            displayMilestoneCode={props.displayMilestoneCode}
            setBtMilestoneDetail={props.setBtMilestoneDetail}
            setStMilestoneDetail={props.setStMilestoneDetail}
            saveCourseToDb={props.saveCourseToDb}
            closeDetailPanel={props.closeDetailPanel}
            requestDeleteCourse={props.requestDeleteCourse}
          />
        </div>
      )}
    </div>
  );
}
