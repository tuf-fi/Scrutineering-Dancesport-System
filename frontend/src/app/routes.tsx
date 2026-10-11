import { Role } from '@bis/shared'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { Placeholder } from '../components/Placeholder.tsx'
import { AdjudicatorSignIn } from '../features/adjudicator/AdjudicatorSignIn.tsx'
import { Waiting } from '../features/adjudicator/Waiting.tsx'
import { ClubSignIn } from '../features/auth/ClubSignIn.tsx'
import { StaffSignIn } from '../features/auth/StaffSignIn.tsx'
import { DesignPreview } from '../features/dev/DesignPreview.tsx'
import { McHome } from '../features/mc/McHome.tsx'
import { AdjudicatorLayout } from './layouts/AdjudicatorLayout.tsx'
import { McLayout } from './layouts/McLayout.tsx'
import { PrintLayout } from './layouts/PrintLayout.tsx'
import { StaffLayout } from './layouts/StaffLayout.tsx'
import { ClubLayout, PublicLayout } from './layouts/TopNavLayout.tsx'
import { clubNav, publicNav, staffNav, type NavItem } from './nav.ts'
import { NotFound } from './NotFound.tsx'
import { RequireRole } from './RequireRole.tsx'
import { RootLayout } from './RootLayout.tsx'

// TODO: each placeholder is replaced by its real screen in steps 6 to 13
function sectionRoutes(items: NavItem[], basePath: string): RouteObject[] {
  return items.map((item) =>
    item.end
      ? { index: true, element: <Placeholder title={item.label} /> }
      : { path: item.to.slice(basePath.length + 1), element: <Placeholder title={item.label} /> },
  )
}

const STAFF = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]

function staffSection(path: string, roles: Role[], items: NavItem[]): RouteObject {
  return {
    path,
    element: <RequireRole roles={roles} signInPath="/login" />,
    children: [{ element: <StaffLayout />, children: sectionRoutes(items, path) }],
  }
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <StaffSignIn /> },

      {
        path: '/adjudicator',
        children: [
          { index: true, element: <AdjudicatorSignIn /> },
          {
            element: <RequireRole roles={[Role.Adjudicator]} signInPath="/adjudicator" />,
            children: [{ element: <AdjudicatorLayout />, children: [{ path: 'waiting', element: <Waiting /> }] }],
          },
        ],
      },

      staffSection('/admin', [Role.Admin], staffNav.admin),
      staffSection('/secretariat', [Role.Secretariat], staffNav.secretariat),
      staffSection('/scrutineer', [Role.Scrutineer, Role.Chairperson], staffNav.scrutineer),

      {
        path: '/mc',
        element: <RequireRole roles={[Role.Mc]} signInPath="/login" />,
        children: [{ element: <McLayout />, children: [{ index: true, element: <McHome /> }] }],
      },

      {
        path: '/print',
        element: <RequireRole roles={STAFF} signInPath="/login" />,
        children: [
          { element: <PrintLayout />, children: [{ index: true, element: <Placeholder title="Printouts" /> }] },
        ],
      },

      { path: '/club/sign-in', element: <ClubSignIn /> },
      {
        path: '/club',
        element: <RequireRole roles={[Role.Club]} signInPath="/club/sign-in" />,
        children: [{ element: <ClubLayout />, children: sectionRoutes(clubNav, '/club') }],
      },

      ...(import.meta.env.DEV ? [{ path: '/dev/design', element: <DesignPreview /> }] : []),

      { path: '/', element: <PublicLayout />, children: sectionRoutes(publicNav, '') },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
