import { Role } from '@bis/shared'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router'
import { AdjudicatorsPage } from '../features/admin/AdjudicatorsPage.tsx'
import { CompetitionsPage } from '../features/admin/CompetitionsPage.tsx'
import { PaymentsPage } from '../features/admin/PaymentsPage.tsx'
import { SyncPage } from '../features/sync/SyncPage.tsx'
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
import { CompetitionPage } from '../features/public/CompetitionPage.tsx'
import { CompetitionsPage as PublicCompetitionsPage } from '../features/public/CompetitionsPage.tsx'
import { EventResultsPage } from '../features/public/EventResultsPage.tsx'
import { HomePage } from '../features/public/HomePage.tsx'
import { CompetitorPage } from '../features/public/CompetitorPage.tsx'
import { RankingsPage } from '../features/public/RankingsPage.tsx'
import { HeatsPage } from '../features/scrutineer/HeatsPage.tsx'
import { LivePage } from '../features/scrutineer/LivePage.tsx'
import { PaperMarksPage } from '../features/scrutineer/PaperMarksPage.tsx'
import { RecallPage } from '../features/scrutineer/RecallPage.tsx'
import { ResultsPage } from '../features/scrutineer/ResultsPage.tsx'
import { RoundsPage } from '../features/scrutineer/RoundsPage.tsx'
import { ClubSignUp } from '../features/club/ClubSignUp.tsx'
import { DancersPage } from '../features/club/DancersPage.tsx'
import { EntriesPage } from '../features/club/EntriesPage.tsx'
import { PaymentsPage as ClubPaymentsPage } from '../features/club/PaymentsPage.tsx'
import { BlankSheetsPage } from '../features/print/BlankSheetsPage.tsx'
import { FinalResultsPage } from '../features/print/FinalResultsPage.tsx'
import { HeatListPage } from '../features/print/HeatListPage.tsx'
import { PrintIndexPage } from '../features/print/PrintIndexPage.tsx'
import { QualifiedPage } from '../features/print/QualifiedPage.tsx'
import { ScoresPage } from '../features/print/ScoresPage.tsx'
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
import { NotFound } from './NotFound.tsx'
import { RequireRole } from './RequireRole.tsx'
import { RootLayout } from './RootLayout.tsx'

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
              { path: 'sync', element: <SyncPage /> },
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
              { path: 'sync', element: <SyncPage /> },
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
              {
                path: 'paper',
                element: <RequireRole roles={[Role.Scrutineer]} signInPath="/login" />,
                children: [{ index: true, element: <PaperMarksPage /> }],
              },
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
              { index: true, element: <PrintIndexPage /> },
              { path: 'heats/:eventId', element: <HeatListPage /> },
              { path: 'recall/:eventId', element: <QualifiedPage /> },
              { path: 'scores/:eventId', element: <ScoresPage /> },
              { path: 'results/:eventId', element: <FinalResultsPage /> },
              { path: 'blank-sheets/:eventId', element: <BlankSheetsPage /> },
            ],
          },
        ],
      },

      { path: '/club/sign-in', element: <ClubSignIn /> },
      { path: '/club/sign-up', element: <ClubSignUp /> },
      {
        path: '/club',
        element: <RequireRole roles={[Role.Club]} signInPath="/club/sign-in" />,
        children: [
          {
            element: <ClubLayout />,
            children: [
              { index: true, element: <DancersPage /> },
              { path: 'events', element: <EntriesPage /> },
              { path: 'payments', element: <ClubPaymentsPage /> },
            ],
          },
        ],
      },

      ...(import.meta.env.DEV ? [{ path: '/dev/design', element: <DesignPreview /> }] : []),

      {
        path: '/',
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'competitions', element: <PublicCompetitionsPage /> },
          { path: 'competitions/:competitionId', element: <CompetitionPage /> },
          { path: 'competitions/:competitionId/events/:eventId', element: <EventResultsPage /> },
          { path: 'rankings', element: <RankingsPage /> },
          { path: 'competitors/:id', element: <CompetitorPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
