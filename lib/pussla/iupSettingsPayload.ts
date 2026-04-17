type NormalizedIupSettings = {
  meetings: any[];
  assessments: any[];
  director_meetings: any[];
  specialist_collegiums: any[];
  planning: any;
  planning_extra: any[];
  instruments: any[];
  planning_hidden: any[];
  show_meetings_on_timeline: boolean;
  show_assessments_on_timeline: boolean;
  show_director_meetings_on_timeline: boolean;
  show_specialist_collegiums_on_timeline: boolean;
};

export function normalizeIupSettings(existing: any): NormalizedIupSettings {
  return {
    meetings: Array.isArray(existing?.meetings) ? existing.meetings : [],
    assessments: Array.isArray(existing?.assessments) ? existing.assessments : [],
    director_meetings: existing?.director_meetings || [],
    specialist_collegiums: existing?.specialist_collegiums || [],
    planning: existing?.planning || null,
    planning_extra: existing?.planning_extra || [],
    instruments: existing?.instruments || [],
    planning_hidden: existing?.planning_hidden || [],
    show_meetings_on_timeline: existing?.show_meetings_on_timeline ?? true,
    show_assessments_on_timeline: existing?.show_assessments_on_timeline ?? true,
    show_director_meetings_on_timeline: existing?.show_director_meetings_on_timeline ?? true,
    show_specialist_collegiums_on_timeline:
      existing?.show_specialist_collegiums_on_timeline ?? true,
  };
}

export function buildIupSettingsUpsertPayload(input: {
  userId: string;
  base: NormalizedIupSettings;
  meetings: any[];
  assessments: any[];
}): Record<string, unknown> {
  const { userId, base, meetings, assessments } = input;
  return {
    user_id: userId,
    meetings,
    assessments,
    director_meetings: base.director_meetings,
    specialist_collegiums: base.specialist_collegiums,
    planning: base.planning,
    planning_extra: base.planning_extra,
    instruments: base.instruments,
    planning_hidden: base.planning_hidden,
    show_meetings_on_timeline: base.show_meetings_on_timeline,
    show_assessments_on_timeline: base.show_assessments_on_timeline,
    show_director_meetings_on_timeline: base.show_director_meetings_on_timeline,
    show_specialist_collegiums_on_timeline: base.show_specialist_collegiums_on_timeline,
    updated_at: new Date().toISOString(),
  };
}
