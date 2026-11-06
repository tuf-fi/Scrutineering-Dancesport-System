import { DEFAULT_AGE_GROUPS, DEFAULT_EVENT_KINDS, type AgeGroupDef, type EventKindDef } from '@bis/shared'

export const eventKinds: EventKindDef[] = structuredClone(DEFAULT_EVENT_KINDS)
export const ageGroups: AgeGroupDef[] = structuredClone(DEFAULT_AGE_GROUPS)
