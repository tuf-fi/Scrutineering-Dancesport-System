import { ProgramStatus } from '@bis/shared'
import { PROGRAM_STATUS_LABEL } from '../lib/format.ts'
import { Badge, type BadgeTone } from './ui/index.ts'

const TONE: Record<ProgramStatus, BadgeTone> = {
  [ProgramStatus.Upcoming]: 'neutral',
  [ProgramStatus.Next]: 'neutral',
  [ProgramStatus.Current]: 'gold',
  [ProgramStatus.Completed]: 'neutral',
}

// Lines still to come show nothing; the word and dot carry the status, not colour alone
export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  if (status === ProgramStatus.Upcoming) return null
  return (
    <Badge pill={status !== ProgramStatus.Completed} tone={TONE[status]}>
      {PROGRAM_STATUS_LABEL[status]}
    </Badge>
  )
}
