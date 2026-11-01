import { Role } from '@bis/shared'
import { Navigate, createBrowserRouter, type RouteObject } from 'react-router'
import { AdjudicatorsPage } from '../features/admin/AdjudicatorsPage.tsx'
import { CompetitionsPage } from '../features/admin/CompetitionsPage.tsx'
import { PaymentsPage } from '../features/admin/PaymentsPage.tsx'
import { FeesPage } from '../features/admin/FeesPage.tsx'
import { ClubsPage } from '../features/secretariat/ClubsPage.tsx'
import { PrivacyPage } from '../features/public/PrivacyPage.tsx'
import { PointsPage } from '../features/admin/PointsPage.tsx'
import { StaffPage } from '../features/admin/StaffPage.tsx'
import { AthletePage } from '../features/athlete/AthletePage.tsx'
import { AthleteSignIn } from '../features/athlete/AthleteSignIn.tsx'
import { AthletesPage } from '../features/secretariat/AthletesPage.tsx'
import { AthleteLayout } from './layouts/AthleteLayout.tsx'
import { AdjudicatorSignIn } from '../features/adjudicator/AdjudicatorSignIn.tsx'
import { MarkPage } from '../features/adjudicator/MarkPage.tsx'
import { SubmittedPage } from '../features/adjudicator/SubmittedPage.tsx'
import { Waiting } from '../features/adjudicator/Waiting.tsx'
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
import { RecallPage } from '../features/scrutineer/RecallPage.tsx'
import { ResultsPage } from '../features/scrutineer/ResultsPage.tsx'
import { RoundsPage } from '../features/scrutineer/RoundsPage.tsx'
import { BlankSheetsPage } from '../features/print/BlankSheetsPage.tsx'
import { FinalResultsPage } from '../features/print/FinalResultsPage.tsx'
import { HeatListPage } from '../features/print/HeatListPage.tsx'
import { PrintIndexPage } from '../features/print/PrintIndexPage.tsx'
import { ProgramPrintPage } from '../features/print/ProgramPrintPage.tsx'
import { PinCardsPage } from '../features/print/PinCardsPage.tsx'
import { QualifiedPage } from '../features/print/QualifiedPage.tsx'
import { ScoresPage } from '../features/print/ScoresPage.tsx'
import { CompetitorsPage } from '../features/secretariat/CompetitorsPage.tsx'
import { EventPage } from '../features/secretariat/EventPage.tsx'
import { EventsPage } from '../features/secretariat/EventsPage.tsx'
import { CoachesPage } from '../features/secretariat/CoachesPage.tsx'
import { LateEntriesPage } from '../features/secretariat/LateEntriesPage.tsx'
import { SecurityPage } from '../features/account/SecurityPage.tsx'
import { ProgramPage as ProgramPublicPage } from '../features/public/ProgramPage.tsx'
import { ProgramPage } from '../features/secretariat/ProgramPage.tsx'
import { SchedulePage } from '../features/secretariat/SchedulePage.tsx'
import { AdjudicatorLayout } from './layouts/AdjudicatorLayout.tsx'
import { McLayout } from './layouts/McLayout.tsx'
import { PrintLayout } from './layouts/PrintLayout.tsx'
import { StaffLayout } from './layouts/StaffLayout.tsx'
import { PublicLayout } from './layouts/TopNavLayout.tsx'
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
        path: '/athlete',
        children: [
          { path: 'sign-in', element: <AthleteSignIn /> },
          {
            element: <RequireRole roles={[Role.Athlete]} signInPath="/athlete/sign-in" />,
            children: [{ element: <AthleteLayout />, children: [{ index: true, element: <AthletePage /> }] }],
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
              { path: 'fees', element: <FeesPage /> },
              { path: 'clubs', element: <ClubsPage /> },
              { path: 'security', element: <SecurityPage /> },
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
              { path: 'clubs', element: <ClubsPage /> },
              { path: 'coaches', element: <CoachesPage /> },
              { path: 'athletes', element: <AthletesPage /> },
              { path: 'late-entries', element: <LateEntriesPage /> },
              { path: 'schedule', element: <SchedulePage /> },
              { path: 'program', element: <ProgramPage /> },
              { path: 'security', element: <SecurityPage /> },
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
              { path: 'security', element: <SecurityPage /> },
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
              { path: 'pin-cards/:competitionId', element: <PinCardsPage /> },
            ],
          },
        ],
      },

      // The program is public, so its printout is too
      {
        path: '/competitions/:competitionId/program/print',
        element: <PrintLayout />,
        children: [{ index: true, element: <ProgramPrintPage /> }],
      },

      ...(import.meta.env.DEV ? [{ path: '/dev/design', element: <DesignPreview /> }] : []),

      {
        path: '/',
        element: <PublicLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'competitions', element: <PublicCompetitionsPage /> },
          { path: 'competitions/:competitionId', element: <CompetitionPage /> },
          { path: 'competitions/:competitionId/program', element: <ProgramPublicPage /> },
          { path: 'competitions/:competitionId/events/:eventId', element: <EventResultsPage /> },
          { path: 'rankings', element: <RankingsPage /> },
          { path: 'privacy', element: <PrivacyPage /> },
          { path: 'competitors/:id', element: <CompetitorPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
