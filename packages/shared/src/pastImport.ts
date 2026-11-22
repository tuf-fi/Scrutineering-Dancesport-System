// Importing a competition that was run before the system existed: one workbook, one sheet per kind of row.
// Every cell arrives as trimmed text; the server checks and reads it.

export const PAST_SHEETS = ['Competition', 'Events', 'Competitors', 'Entries', 'Adjudicators', 'Rounds', 'Marks', 'Placings'] as const
export type PastSheet = (typeof PAST_SHEETS)[number]

export const PAST_COLUMNS: Record<PastSheet, readonly string[]> = {
  Competition: ['name', 'date', 'venue', 'organizer', 'executor'],
  Events: ['event_no', 'age_group', 'class', 'discipline', 'dances', 'solo', 'kind', 'province', 'uses_points'],
  Competitors: ['back_number', 'name_1', 'name_2', 'team', 'birth_date'],
  Entries: ['event_no', 'back_number'],
  Adjudicators: ['letter', 'name'],
  Rounds: ['event_no', 'round', 'back_number'],
  Marks: ['event_no', 'round', 'adjudicator', 'back_number', 'dance', 'mark'],
  Placings: ['event_no', 'back_number', 'place'],
}

export const PAST_HELP: Record<PastSheet, string> = {
  Competition: 'One row: the name, the date (YYYY-MM-DD), the venue and the organizer. The executor is optional.',
  Events: 'One row per event. Dances are listed with commas, such as waltz, tango. Solo is yes or no. Kind and province are optional.',
  Competitors: 'One row per couple or solo dancer. The back number is the one worn that day; name 2 is empty for a solo dancer.',
  Entries: 'Optional. Who entered which event. Dancers named in the Rounds, Marks or Placings sheets are entered automatically.',
  Adjudicators: 'The adjudicators of that competition, with the letter printed on the sheets.',
  Rounds: 'Who danced each round: one row per round and back number. Needed for every round of an event that has marks.',
  Marks: 'One row per mark. X in a round before the final; a placing (1, 2, 3...) in the final. Every dance has its own rows.',
  Placings: 'Optional. The printed final placing of each back number. It is kept as the record, and compared with the marks.',
}

export type PastRow = Record<string, string>

export interface PastWorkbook {
  sheets: Partial<Record<PastSheet, PastRow[]>>
  // The photo on the competition's card, as a data URL; the competition always has one
  image: string
}

export interface PastIssue {
  sheet: PastSheet | 'File'
  // The row as the spreadsheet numbers it (the header is row 1); 0 when it is about the sheet as a whole
  row: number
  message: string
}

export interface PastImportReport {
  // True once everything was saved; a trial run, or one with errors, keeps nothing
  imported: boolean
  errors: PastIssue[]
  // Things the marks and the printed sheet disagree on; the import still goes ahead
  warnings: PastIssue[]
  counts: { events: number; competitors: number; adjudicators: number; rounds: number; marks: number; results: number; newTeams: number; newAdjudicators: number }
  competitionName: string
}
