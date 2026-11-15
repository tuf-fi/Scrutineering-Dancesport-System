import { Role } from '@bis/shared'

// The roles whose signature is printed on the final results and the certificates
const SIGNING_ROLES = new Set<Role>([Role.Scrutineer, Role.Chairperson])

export const signsResults = (role: Role | undefined) => (role ? SIGNING_ROLES.has(role) : false)
