import { DEFAULT_AGE_GROUPS, DEFAULT_CLASSES, DEFAULT_EVENT_KINDS, type AgeGroupDef, type ClassDef, type EventKindDef } from '@bis/shared'

export const classes: ClassDef[] = structuredClone(DEFAULT_CLASSES)
export const eventKinds: EventKindDef[] = structuredClone(DEFAULT_EVENT_KINDS)
export const ageGroups: AgeGroupDef[] = structuredClone(DEFAULT_AGE_GROUPS)
