// In production a staff account's email is its role at one domain: secretariat@boss2026.com
export const staffEmailFor = (role: string, domain: string) => `${role}@${domain}`
