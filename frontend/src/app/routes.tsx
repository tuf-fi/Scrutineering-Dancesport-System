import { Role } from '@bis/shared'
import { Navigate, createBrowserRouter, useLocation, type RouteObject } from 'react-router'
import { AdjudicatorsPage } from '../features/admin/AdjudicatorsPage.tsx'
import { CategoriesPage } from '../features/admin/CategoriesPage.tsx'
import { CompetitionsPage } from '../features/admin/CompetitionsPage.tsx'
import { PaymentsPage } from '../features/admin/PaymentsPage.tsx'
import { FeesPage } from '../features/admin/FeesPage.tsx'
import { SitePage } from '../features/admin/SitePage.tsx'
import { TeamsPage } from '../features/secretariat/TeamsPage.tsx'
import { PrivacyPage } from '../features/public/PrivacyPage.tsx'
import { PointsPage } from '../features/admin/PointsPage.tsx'
import { StaffPage } from '../features/admin/StaffPage.tsx'
import { AccountPage, AthletePage, EditAccountPage, EntriesPage, MembershipPage, NotificationsPage, PaymentsPage as MyPaymentsPage, PasswordPage, RankingsPage as MyRankingsPage, RegisterEventsPage, RequestsPage, ResultsPage as MyResultsPage } from '../features/athlete/AthletePage.tsx'
import { AthleteSignIn, MemberSignIn, SignInPage } from '../features/athlete/AthleteSignIn.tsx'
import { EntryRequestsPage } from '../features/secretariat/EntryRequestsPage.tsx'
import { AccountLinksPage } from '../features/secretariat/AccountLinksPage.tsx'
import { ProfileChangesPage } from '../features/secretariat/ProfileChangesPage.tsx'
import { AthletesPage } from '../features/secretariat/AthletesPage.tsx'
import { AdjudicatorSignIn } from '../features/adjudicator/AdjudicatorSignIn.tsx'
import { MarkPage } from '../features/adjudicator/MarkPage.tsx'
import { SubmittedPage } from '../features/adjudicator/SubmittedPage.tsx'
import { Waiting } from '../features/adjudicator/Waiting.tsx'
import { StaffAccountPage } from '../features/auth/StaffAccountPage.tsx'
import { StaffSignIn } from '../features/auth/StaffSignIn.tsx'
import { DesignPreview } from '../features/dev/DesignPreview.tsx'
import { BarkerPage } from '../features/barker/BarkerPage.tsx'
import { CompereHome } from '../features/compere/CompereHome.tsx'
import { CompetitionPage } from '../features/public/CompetitionPage.tsx'
import { CompetitionsPage as PublicCompetitionsPage } from '../features/public/CompetitionsPage.tsx'
import { EventResultsPage } from '../features/public/EventResultsPage.tsx'
import { HomePage } from '../features/public/HomePage.tsx'
import { CompetitorPage } from '../features/public/CompetitorPage.tsx'
import { AthleteDirectoryPage } from '../features/public/AthleteDirectoryPage.tsx'
import { RankingsPage } from '../features/public/RankingsPage.tsx'
import { HeatsPage } from '../features/scrutineer/HeatsPage.tsx'
import { PaperMarksPage } from '../features/scrutineer/PaperMarksPage.tsx'
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
import { CompereLayout } from './layouts/CompereLayout.tsx'
import { PrintLayout } from './layouts/PrintLayout.tsx'
import { StaffLayout } from './layouts/StaffLayout.tsx'
import { PublicLayout } from './layouts/TopNavLayout.tsx'
import { STAFF_SIGN_IN } from './nav.ts'
import { MemberAccountPage, MemberDancersPage, MemberEditPage, MemberEntriesPage, MemberHome, MemberRegisterPage, MemberRequestsPage, MemberLinkPage, MemberNotificationsPage, MemberPasswordPage, MemberPaymentsPage, MemberRankingsPage, MemberResultsPage } from '../features/athlete/MemberHome.tsx'
import { NotFound } from './NotFound.tsx'
import { RequireRole } from './RequireRole.tsx'
import { RootLayout } from './RootLayout.tsx'

const STAFF = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]

// The points page used to live at /rankings; old links and bookmarks keep working
function LegacyRankings() {
  return <Navigate to={`/standings${useLocation().search}`} replace />
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: STAFF_SIGN_IN, element: <StaffSignIn /> },

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

      // The public sign-in for athletes, coaches and teams; staff use their own address
      { path: '/login', element: <SignInPage /> },
      { path: '/sign-in', element: <Navigate to="/login" replace /> },

      {
        path: '/athlete',
        children: [
          { path: 'sign-in', element: <AthleteSignIn /> },
          {
            element: <RequireRole roles={[Role.Athlete]} signInPath="/athlete/sign-in" />,
            children: [
              {
                element: <PublicLayout />,
                children: [
                  {
                    element: <AthletePage />,
                    children: [
                      { index: true, element: <AccountPage /> },
                      { path: 'edit', element: <EditAccountPage /> },
                      { path: 'membership', element: <MembershipPage /> },
                      { path: 'payments', element: <MyPaymentsPage /> },
                      { path: 'results', element: <MyResultsPage /> },
                      { path: 'rankings', element: <MyRankingsPage /> },
                      { path: 'entries', element: <EntriesPage /> },
                      { path: 'register', element: <RegisterEventsPage /> },
                      { path: 'requests', element: <RequestsPage /> },
                      { path: 'notifications', element: <NotificationsPage /> },
                      { path: 'password', element: <PasswordPage /> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      ...(['coach', 'team'] as const).map((kind) => ({
        path: `/${kind}`,
        children: [
          { path: 'sign-in', element: <MemberSignIn kind={kind} /> },
          {
            element: <RequireRole roles={[kind === 'team' ? Role.Team : Role.Coach]} signInPath={`/${kind}/sign-in`} />,
            children: [
              {
                element: <PublicLayout />,
                children: [
                  {
                    element: <MemberHome />,
                    children: [
                      { index: true, element: <MemberAccountPage /> },
                      { path: 'link', element: <MemberLinkPage /> },
                      { path: 'edit', element: <MemberEditPage /> },
                      { path: 'notifications', element: <MemberNotificationsPage /> },
                      { path: 'dancers', element: <MemberDancersPage /> },
                      { path: 'results', element: <MemberResultsPage /> },
                      { path: 'rankings', element: <MemberRankingsPage /> },
                      { path: 'entries', element: <MemberEntriesPage /> },
                      { path: 'password', element: <MemberPasswordPage /> },
                      ...(kind === 'team'
                        ? [
                            { path: 'payments', element: <MemberPaymentsPage /> },
                            { path: 'register', element: <MemberRegisterPage /> },
                            { path: 'requests', element: <MemberRequestsPage /> },
                          ]
                        : []),
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })),

      {
        path: '/admin',
        element: <RequireRole roles={[Role.Admin]} signInPath={STAFF_SIGN_IN} />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <Navigate to="/admin/competitions" replace /> },
              { path: 'competitions', element: <CompetitionsPage /> },
              { path: 'categories', element: <CategoriesPage /> },
              { path: 'staff', element: <StaffPage /> },
              { path: 'adjudicators', element: <AdjudicatorsPage /> },
              { path: 'points', element: <PointsPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'fees', element: <FeesPage /> },
              { path: 'site', element: <SitePage /> },
              { path: 'security', element: <SecurityPage /> },
            ],
          },
        ],
      },
      {
        path: '/secretariat',
        element: <RequireRole roles={[Role.Secretariat, Role.Admin]} signInPath={STAFF_SIGN_IN} />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              { index: true, element: <EventsPage /> },
              { path: 'events/:eventId', element: <EventPage /> },
              { path: 'competitors', element: <CompetitorsPage /> },
              { path: 'teams', element: <TeamsPage /> },
              { path: 'coaches', element: <CoachesPage /> },
              { path: 'athletes', element: <AthletesPage /> },
              { path: 'account-links', element: <AccountLinksPage /> },
              { path: 'profile-changes', element: <ProfileChangesPage /> },
              { path: 'entry-requests', element: <EntryRequestsPage /> },
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
        element: <RequireRole roles={[Role.Scrutineer, Role.Chairperson]} signInPath={STAFF_SIGN_IN} />,
        children: [
          {
            element: <StaffLayout />,
            children: [
              {
                element: <RequireRole roles={[Role.Scrutineer]} signInPath={STAFF_SIGN_IN} />,
                children: [
                  { index: true, element: <RoundsPage /> },
                  { path: 'heats', element: <HeatsPage /> },
                  { path: 'paper-marks', element: <PaperMarksPage /> },
                ],
              },
              { path: 'live', element: <LivePage /> },
              { path: 'recall', element: <RecallPage /> },
              { path: 'results', element: <ResultsPage /> },
              { path: 'security', element: <SecurityPage /> },
            ],
          },
        ],
      },

      { path: '/mc', element: <Navigate to="/compere" replace /> },
      {
        path: '/compere',
        element: <RequireRole roles={[Role.Compere]} signInPath={STAFF_SIGN_IN} />,
        children: [{ element: <CompereLayout />, children: [{ index: true, element: <CompereHome /> }] }],
      },

      {
        path: '/barker',
        element: <RequireRole roles={[Role.Barker, ...STAFF]} signInPath={STAFF_SIGN_IN} />,
        children: [{ element: <StaffLayout />, children: [{ index: true, element: <BarkerPage /> }] }],
      },

      {
        // Every staff member's own account: their name and their password
        path: '/account',
        element: <RequireRole roles={[...STAFF, Role.Compere, Role.Barker]} signInPath={STAFF_SIGN_IN} />,
        children: [{ element: <StaffLayout />, children: [{ index: true, element: <StaffAccountPage /> }] }],
      },

      {
        path: '/print',
        element: <RequireRole roles={STAFF} signInPath={STAFF_SIGN_IN} />,
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
          { path: 'results', element: <PublicCompetitionsPage results /> },
          { path: 'results/:competitionId', element: <CompetitionPage resultsOnly /> },
          { path: 'athletes', element: <AthleteDirectoryPage /> },
          { path: 'standings', element: <RankingsPage /> },
          { path: 'rankings', element: <LegacyRankings /> },
          { path: 'privacy', element: <PrivacyPage /> },
          { path: 'competitors/:id', element: <CompetitorPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
