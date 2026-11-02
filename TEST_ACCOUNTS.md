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
| MC | Dante Ibarra | `mc@sample.example` |

## Athlete, coach and team

Sign in from the Sign in button in the navbar (pick Athlete, Coach or Team), or at `/sign-in`.

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
