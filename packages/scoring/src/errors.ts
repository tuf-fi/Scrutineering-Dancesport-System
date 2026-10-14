// Thrown when marks cannot be scored; `issues` lists everything wrong so the scrutineer can fix it in one go
export class ScoringError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join('; '))
    this.name = 'ScoringError'
    this.issues = issues
  }
}
