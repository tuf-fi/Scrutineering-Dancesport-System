// The syllabus box on the adjudicator's page: an event's own text, else the standard text for Juvenile up to Junior I
// (matched by the family an age group started with, so a newer version still counts).
export const SYLLABUS_AGE_GROUPS = ['juvenile_1', 'juvenile_2', 'junior_1']

// TODO: replace with the organizer's syllabus for each of these age groups; the admin can already set one per event
export const DEFAULT_SYLLABUS =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

export function syllabusFor(event: { syllabus?: string; ageGroup: string }, ageGroupFamily: string): string {
  if (event.syllabus?.trim()) return event.syllabus.trim()
  return SYLLABUS_AGE_GROUPS.includes(ageGroupFamily) ? DEFAULT_SYLLABUS : ''
}
