import { Navigate, useLocation } from 'react-router'

// The points page used to live at /rankings; old links and bookmarks keep working
export function LegacyRankings() {
  return <Navigate to={`/standings${useLocation().search}`} replace />
}
