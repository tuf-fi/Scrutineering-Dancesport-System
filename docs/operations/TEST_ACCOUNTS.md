# Test accounts

Sample accounts for trying BIS. They come from the sample data (`pnpm db:seed`, or the sample preview with `pnpm dev:sample`). Do not use them on a real server: the password is public.

**Password for every account with an email: `bis2026`**

## Staff

Sign in at `/staff-access` with email and password.

| Role | Name | Email |
| --- | --- | --- |
| Admin | Amelia Rosales | `admin@sample.example` |
| Secretariat | Jonas Bellosillo | `secretariat@sample.example` |
| Scrutineer | Teresita Quimpo | `scrutineer@sample.example` |
| Chairperson | Gregorio Almazan | `chairperson@sample.example` |
| Compere | Dante Ibarra | `compere@sample.example` |

## Athlete, coach and team

Press Sign in in the navbar (on a phone, in the menu), pick Athlete, Coach or Team and press Continue, or go straight to `/login`.

| Role | Name | Email |
| --- | --- | --- |
| Athlete | Ana Cruz | `athlete@sample.example` |
| Coach | Rico Bautista | `coach@sample.example` |
| Team | Sample Dance Team | `team@sample.example` |

## Adjudicators

Adjudicators sign in with a six-digit PIN, not an email. Use the PIN tab on `/staff-access`, or `/adjudicator`.

| Letter | Name | PIN |
| --- | --- | --- |
| A | Lorenzo V. Aguilar | `410000` |
| B | Patricia M. Dizon | `421100` |
| C | Ramon T. Hernandez | `432200` |
| D | Celeste B. Ilagan | `443300` |
| E | Victor L. Manalo | `454400` |
| F | Rowena S. Panganiban | `465500` |
| G | Dionisio C. Quizon | `476600` |
| H | Helena P. Sarmiento | `487700` |
| I | Alfredo G. Tabora | `498800` |

The PINs above are the sample ones. On a real database an admin makes new PINs from the Adjudicators and panels screen, so check there if a PIN is refused.

## Public

The public site (program, results, rankings) needs no account.

## One competition with every scenario

For trying every screen with believable data, three commands in `backend/` build and check one competition, "Bicol Grand Prix 2026", dated today. The server must be running for the last two.

```
pnpm db:clean-slate -- --yes --catalog   removes every competition, team, coach, athlete and member account, and puts the age groups, kinds and classes back to the defaults; staff, adjudicators, the points table and the fees stay
pnpm db:scenario                         builds the competition through the real server, signing in as each role
pnpm db:verify                           checks the data and opens every page as every role; it fails on any error
```

Take a backup of `data/bis.db` first. The server allows five sign-ups an hour from one address and the scenario makes four, so restart the server before running it a second time.

What the competition holds:

- **Events:** 14, in every age group (Juvenile 1 to Senior), solo and couple, Latin and Standard, and every kind: standard, Beginners, Ranking (a ranking event counts points), Inter-elementary (not counted), Closed to Albay, and one with nobody entered.
- **Finished and published:** a solo event with a semi-final and final; a final only; one that goes through all five rounds (Round 1, Round 2, Quarter-final, Semi-final, Final) with heats and a rotating set of five of seven adjudicators; a semi-final where two couples finish level on the cut-off so seven go through when six were asked for; and a final where two couples tie and the scrutineer keeps the shared place, confirmed by the chairperson.
- **Live now:** a semi-final in review (everyone has marked, waiting for the scrutineer), one with a heat being danced again (a redance waiting for its marks), and one being marked with three of five adjudicators in, one of them typed from a paper sheet.
- **Waiting to start:** events with unpaid entries (which cannot start), a Beginners event, an event with late entries (one paid in cash, one unpaid), and an event open for entries.
- **Entries and money:** every way of paying (GCash, Maya, bank, cash), unpaid entries, a coach's membership collected with an entry, scratched entries, and a couple whose partners are different ages (the older partner decides the group).
- **Accounts:** the team account `team@sample.example` (linked; one entry approved, one turned down, one waiting), `team2@sample.example` (asking to be linked, waiting), the coach account `coach@sample.example` (linked), the athlete account `athlete@sample.example` (with a team change waiting for the secretariat), and the barker `barker@sample.example`. All use the password `bis2026`.
- **The day:** a program with start time, breaks and the awarding, and PINs for the adjudicators of this competition (print them from Adjudicators and panels).
