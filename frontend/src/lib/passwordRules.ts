export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'case', label: 'An uppercase and a lowercase letter', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'A number', test: (p: string) => /\d/.test(p) },
]

export function passwordMeetsRules(password: string) {
  return PASSWORD_RULES.every((r) => r.test(password))
}
