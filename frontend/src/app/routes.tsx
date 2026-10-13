import { Role } from '@bis/shared'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router'
import { Placeholder } from '../components/Placeholder.tsx'
import { AdjudicatorsPage } from '../features/admin/AdjudicatorsPage.tsx'
import { CompetitionsPage } from '../features/admin/CompetitionsPage.tsx'
import { PaymentsPage } from '../features/admin/PaymentsPage.tsx'
import { PointsPage } from '../features/admin/PointsPage.tsx'
import { StaffPage } from '../features/admin/StaffPage.tsx'
import { AdjudicatorSignIn } from '../features/adjudicator/AdjudicatorSignIn.tsx'
import { MarkPage } from '../features/adjudicator/MarkPage.tsx'
import { SubmittedPage } from '../features/adjudicator/SubmittedPage.tsx'
import { Waiting } from '../features/adjudicator/Waiting.tsx'
import { ClubSignIn } from '../features/auth/ClubSignIn.tsx'
import { StaffSignIn } from '../features/auth/StaffSignIn.tsx'
import { DesignPreview } from '../features/dev/DesignPreview.tsx'
import { McHome } from '../features/mc/McHome.tsx'
import { CompetitorPage } from '../features/public/CompetitorPage.tsx'
import { RankingsPage } from '../features/public/RankingsPage.tsx'
import { HeatsPage } from '../features/scrutineer/HeatsPage.tsx'
import { LivePage } from '../features/scrutineer/LivePage.tsx'
import { RecallPage } from '../features/scrutineer/RecallPage.tsx'
import { ResultsPage } from '../features/scrutineer/ResultsPage.tsx'
import { RoundsPage } from '../features/scrutineer/RoundsPage.tsx'
import { CompetitorsPage } from '../features/secretariat/CompetitorsPage.tsx'
import { EventPage } from '../features/secretariat/EventPage.tsx'
import { EventsPage } from '../features/secretariat/EventsPage.tsx'
import { LateEntriesPage } from '../features/secretariat/LateEntriesPage.tsx'
import { SchedulePage } from '../features/secretariat/SchedulePage.tsx'
import { AdjudicatorLayout } from './layouts/AdjudicatorLayout.tsx'
import { McLayout } from './layouts/McLayout.tsx'
import { PrintLayout } from './layouts/PrintLayout.tsx'
import { StaffLayout } from './layouts/StaffLayout.tsx'
import { ClubLayout, PublicLayout } from './layouts/TopNavLayout.tsx'
import { clubNav, publicNav, type NavItem } from './nav.ts'
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
            children: [
              {
                element: <AdjudicatorLayout />,
                children: [
                  { path: 'waiting', element: <Waiting /> },
                  { path: 'mark', element: <MarkPage /> },
                  { path: 'submitted', element: <SubmittedPage /> },
                ],
              },
            ],
          },
        ],
      },

      {
        path: '/admin',
        element: <RequireRole roles={[Role.Admin]} signInPath="/login" />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/competitions" replace /> },
              { path: 'competitions', element: <CompetitionsPage /> },
              { path: 'staff', element: <StaffPage /> },
              { path: 'adjudicators', element: <AdjudicatorsPage /> },
              { path: 'points', element: <PointsPage /> },
              { path: 'payments', element: <PaymentsPage /> },
            ],
          },
        ],
      },
      {
        path: '/secretariat',
        element: <RequireRole roles={[Role.Secretariat]} signInPath="/login" />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <EventsPage /> },
              { path: 'events/:eventId', element: <EventPage /> },
              { path: 'competitors', element: <CompetitorsPage /> },
              { path: 'late-entries', element: <LateEntriesPage /> },
              { path: 'schedule', element: <SchedulePage /> },
            ],
          },
        ],
      },
      {
        path: '/scrutineer',
        element: <RequireRole roles={[Role.Scrutineer, Role.Chairperson]} signInPath="/login" />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <RoundsPage /> },
              { path: 'heats', element: <HeatsPage /> },
              { path: 'live', element: <LivePage /> },
              { path: 'recall', element: <RecallPage /> },
              { path: 'results', element: <ResultsPage /> },
            ],
          },
        ],
      },

      {
        path: '/mc',
        element: <RequireRole roles={[Role.Mc]} signInPath="/login" />,
        children: [{ element: <McLayout />, children: [{ index: true, element: <McHome /> }] }],
      },

      {
        path: '/print',
        element: <RequireRole roles={STAFF} signInPath="/login" />,
        children: [
          {
            element: <PrintLayout />,
            children: [
              { index: true, element: <Placeholder title="Printouts" /> },
              // TODO: step 11 builds the heat and recall lists these links open
              { path: 'heats/:eventId', element: <Placeholder title="Heat list" /> },
              { path: 'recall/:eventId', element: <Placeholder title="Recall list" /> },
            ],
          },
        ],
      },

      { path: '/club/sign-in', element: <ClubSignIn /> },
      {
        path: '/club',
        element: <RequireRole roles={[Role.Club]} signInPath="/club/sign-in" />,
        children: [{ element: <ClubLayout />, children: sectionRoutes(clubNav, '/club') }],
      },

      ...(import.meta.env.DEV ? [{ path: '/dev/design', element: <DesignPreview /> }] : []),

      {
        path: '/',
        element: <PublicLayout />,
        children: [
          ...sectionRoutes(
            publicNav.filter((item) => item.to !== '/rankings'),
            '',
          ),
          { path: 'rankings', element: <RankingsPage /> },
          { path: 'competitors/:id', element: <CompetitorPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
