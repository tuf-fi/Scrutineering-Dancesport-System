import { Navigate, useLocation } from 'react-router'
import { STAFF_SIGN_IN } from './nav.ts'

const STAFF_AREAS = ['/admin', '/secretariat', '/scrutineer', '/print', '/compere', '/barker', '/account']
const inArea = (path: string, area: string) => path === area || path.startsWith(`${area}/`)

// An address that matches no screen: staff areas go to the staff sign-in, everything else to the home page
export function NotFound() {
  const { pathname } = useLocation()
  if (inArea(pathname, '/adjudicator')) return <Navigate to="/adjudicator" replace />
  return <Navigate to={STAFF_AREAS.some((a) => inArea(pathname, a)) ? STAFF_SIGN_IN : '/'} replace />
}
