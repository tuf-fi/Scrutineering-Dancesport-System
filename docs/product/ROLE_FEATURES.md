# What each role can do

Every role in BIS, the screens it has, and everything it can do on them. Written from the server's permission list (`backend/src/registry.ts`) and the screens, so a role can do exactly what is listed here and nothing else. How a competition runs from start to finish is in [FLOW.md](FLOW.md); who the roles are is in [ROLES_README.md](ROLES_README.md); how their accounts are made is in [../operations/ROLE_ACCOUNTS.md](../operations/ROLE_ACCOUNTS.md); a short how-to for each is in [../guides/](../guides/).

## At a glance

| | Public | Athlete | Coach | Team | Adjudicator | MC | Scrutineer | Chairperson | Secretariat | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Signs in with | nothing | email | email | email | PIN | email | email | email | email | email |
| Device | phone | phone or laptop | phone or laptop | phone or laptop | phone | laptop or projector | laptop | laptop | laptop | laptop |
| Starts at | `/` | `/athlete` | `/coach` | `/team` | `/adjudicator` | `/mc` | `/scrutineer` | `/scrutineer` | `/secretariat` | `/admin` |
| Sees published results and rankings | yes | yes | yes | yes | no | yes | yes | yes | yes | yes |
| Sends an entry online | no | own name | no | own dancers | no | no | no | no | no | no |
| Enters dancers into events | no | no | no | no | no | no | no | no | yes | yes (same screens) |
| Marks | no | no | no | no | yes | no | no | no | no | no |
| Runs, approves, publishes rounds | no | no | no | no | no | no | yes | no | no | no |
| Confirms ties | no | no | no | no | no | no | proposes | confirms | no | no |
| Gets pop-up notifications | no | yes | yes | yes | no | no | yes | yes | yes | yes |

Everyone who signs in with an email can change their own password. Staff can also turn on two-step sign-in. Athletes, coaches and teams can sign themselves out everywhere.

---

## Public (no account)

**Device:** phone. Nothing needs a sign-in.

| Page | Path | What you can do |
| --- | --- | --- |
| Home | `/` | See the hero, **Upcoming events** (a photo card per competition with its date and countdown, opening that competition), **Latest competitions** (opens the ranking of that competition), and **How to join** |
| Competitions | `/competitions` | Browse all competitions, search them and filter by year; see which are live, soon or done |
| A competition | `/competitions/:id` | See its events with search and filters, open an event, open the program |
| Program | `/competitions/:id/program` | See what is on the floor now and what is next, the whole running order, filter by back number to follow one competitor, and **Print** or save a PDF |
| Event results | `/competitions/:id/events/:eventId` | Read the published results of an event |
| Athletes | `/athletes` | Search the directory of competitors and teams |
| A competitor | `/competitors/:id` | See a couple or solo dancer's points, results and history |
| Rankings | `/rankings` | Rankings by age group, class and discipline |
| Privacy notice | `/privacy` | Read how entry-form details are kept |
| Sign in | menu → **Sign in** | Choose Athlete, Coach or Team and continue to the sign-in page, or create an account |

Only **published** results are public. A round that is still being marked or has not been published is not shown.

---

## Athlete

**Account:** makes their own, with an email and a password (at least 8 characters), at `/login?as=athlete`. **Sees:** only their own data, and only what the secretariat has linked to their name.

| Page | Path | What you can do |
| --- | --- | --- |
| Account | `/athlete` | See your details, picture, team and coach, membership status, and **Account information** (date of birth, contact number, province, address; only the secretariat sees these) |
| Edit account | `/athlete/edit` | Change your details and picture. Changing your **team or coach** is a request the secretariat approves; your current ones stay until then |
| Membership | `/athlete/membership` | See the year's fee and where to pay, then send a payment (how you paid and the reference number). It shows **Waiting for the secretariat**, and if turned down you see why and can send it again |
| Payments | `/athlete/payments` | Your payment history |
| Results | `/athlete/results` | Your results, by competition |
| Rankings | `/athlete/rankings` | Your points and where you stand |
| Entries | `/athlete/entries` | The events you are entered in, by competition |
| Enter events | `/athlete/register` | Pick the competition and one of your events (a solo or a couple that carries your name), see the fee and any warning, pay to GCash, Maya or the bank, attach a screenshot, and **Send entry** |
| My requests | `/athlete/requests` | See each entry you sent as Waiting, Approved or Not approved (with the reason); **take back** a waiting one |
| Notifications | `/athlete/notifications` | Read what the secretariat decided; unread ones also arrive as a pop-up with a sound. Press one to open the page it is about |
| Password | `/athlete/password` | Change your password; **Sign out everywhere** |

**Limits:** cannot enter anyone but themselves, cannot see other athletes' details, and nothing they send is entered until the secretariat approves it. A request cannot cover an event that is already waiting or already entered.

---

## Coach

**Account:** makes their own at `/login?as=coach`. After signing up the account is **not linked** to anything and shows a notice on every page that needs the link.

| Page | Path | What you can do |
| --- | --- | --- |
| Account | `/coach` | See your details, picture and what you are linked to |
| Link your coach | `/coach/link` | Pick your coach record and send a request; **take it back** while it waits. The secretariat approves or turns it down |
| Edit account | `/coach/edit` | Change your name, contact details and picture |
| Notifications | `/coach/notifications` | Read what the secretariat decided; pop-ups arrive live |
| Dancers | `/coach/dancers` | The athletes coached by you (needs the link) |
| Results | `/coach/results` | Their results |
| Rankings | `/coach/rankings` | Where they stand |
| Entries | `/coach/entries` | The events they are entered in |
| Password | `/coach/password` | Change your password; **Sign out everywhere** |

**Limits:** a coach can look but not enter. A coach has no entry or payment pages.

---

## Team

**Account:** makes their own at `/login?as=team`, then links it to the team record.

| Page | Path | What you can do |
| --- | --- | --- |
| Account | `/team` | See your details, picture and what you are linked to |
| Link your team | `/team/link` | Pick your team and send a request; take it back while it waits |
| Edit account | `/team/edit` | Change the team's contact details and picture |
| Notifications | `/team/notifications` | What the secretariat decided; pop-ups arrive live |
| Dancers | `/team/dancers` | Your team's dancers and couples (needs the link) |
| Results | `/team/results` | Their results |
| Rankings | `/team/rankings` | Where they stand |
| Entries | `/team/entries` | The events they are entered in |
| Payments | `/team/payments` | What has been paid and how |
| Enter events | `/team/register` | Pick one of your dancers, the competition and events; see the fee and warnings; pay and attach a screenshot; **Send entry** |
| My requests | `/team/requests` | Waiting, Approved or Not approved (with the reason); **take back** a waiting one |
| Password | `/team/password` | Change your password; **Sign out everywhere** |

**Limits:** can enter only dancers on its own team. Nothing is entered until the secretariat approves it.

---

## Adjudicator

**Device:** a phone, one hand, large touch targets. **Account:** none. The admin adds the adjudicator and prints a six-digit PIN (with a QR code) for each competition. The PIN works one day either side of the competition date, on one phone at a time.

| Screen | Path | What you can do |
| --- | --- | --- |
| Sign in | `/adjudicator` | Type the PIN or scan the QR code |
| Waiting | `/adjudicator/waiting` | Wait; the next round appears by itself when the scrutineer starts it |
| Mark | `/adjudicator/mark` | Early rounds: mark an X for **exactly** the number of couples shown. Finals: place every finalist, first to last, in each dance. The counter shows how many are marked. **Submit**, check the summary, **sign with your finger** (**Clear** to sign again), **Confirm** |
| Submitted | `/adjudicator/submitted` | See that your marks are in |

**Safety:** your marks are saved on the phone first. A dropped connection loses nothing: they send themselves when it is back, and the scrutineer can see the phone holds marks. A refreshed page or closed browser brings your marks back. Marks **cannot be changed** after Confirm; tell the scrutineer before they approve. No pop-ups, no other screens.

---

## MC

**Device:** a laptop or projector. **Account:** email and password, made by the admin.

| Screen | Path | What you can do |
| --- | --- | --- |
| Announcer | `/mc` | Read the announcements of the round just **published**: places in order, last place first, in very large type. **Next announcement** and **Previous announcement** move through them; the program is shown too |
| Account | `/account` | Change your name and password; turn on two-step sign-in |

Nothing shows until the scrutineer publishes a round. The MC changes nothing about the competition and gets no pop-ups.

---

## Scrutineer

**Device:** a laptop, kept open all day. **Account:** email and password, made by the admin.

| Screen | Path | What you can do |
| --- | --- | --- |
| Rounds | `/scrutineer` | See where the competition is and every round still to run. **Plan rounds** (once) so every event with entries gets its rounds. **Start round** (put it on the floor and on the phones; refused while entries are unpaid). **Take off the floor** a wrong round, until a phone has submitted. Open a round's Live board, Heats, Recall or Results |
| Heats | `/scrutineer/heats` | **Split evenly** into heats, move any competitor to another heat, **save** the heats |
| Live board | `/scrutineer/live` | Watch each adjudicator's phone go from waiting to marking to submitted. A phone silent for 20 seconds, or "marks on the phone, not sent", is flagged. **Review the recall** (or **results**) when all are in |
| Recall | `/scrutineer/recall` | See the X marks per competitor and the cut-off for the next round. For a tie at the cut-off: choose how to settle it and **Propose decision** |
| Results | `/scrutineer/results` | See each adjudicator's marks and the skating table. For a tie in a final: propose keeping the shared place or a tie-break order. **Approve results** (saves the result, adds ranking points, takes a backup), then **Publish results** (makes it public and shows it to the MC). **Print summary** |
| Paper marks | `/scrutineer/paper-marks` | When an adjudicator's phone could not send their marks, choose the round and the adjudicator who handed in a sheet (only those who have not submitted are listed), type in exactly what is on it (X marks, or placings in a final) and press **Enter marks**. They count the same as marks sent from the phone and the adjudicator shows as submitted on the Live board. Only while a round is being marked or reviewed; not after it is approved |
| Printouts | `/print` | Heat list, qualified list, scores sheet, final results and blank mark sheets for any event or round |
| Security | `/scrutineer/security` | Turn on two-step sign-in, change your password |
| Backups | top of the screen | A warning appears if a backup folder fails |

**Limits:** cannot confirm their own tie proposal (the chairperson does). Cannot enter or edit entries.
**Paper marks** (above) is the scrutineer's page for typing in a paper sheet. The chairperson does not have it.

---

## Chairperson

**Device:** a laptop. **Account:** email and password, made by the admin.

| Screen | Path | What you can do |
| --- | --- | --- |
| Rounds, Heats, Live board, Recall, Results | `/scrutineer/...` | See all of the scrutineer's screens and marks, read-only |
| Recall | `/scrutineer/recall` | **Confirm tie decision** on a tie at the recall cut-off |
| Results | `/scrutineer/results` | **Confirm tie decision** on a tie in a final; look at the places and skating tables before they are published |
| Printouts, Security | `/print`, `/scrutineer/security` | As the scrutineer |

**Limits:** cannot start, approve or publish a round, and cannot enter marks. Every decision is stored with their name and the time.

---

## Secretariat

**Device:** a laptop. **Account:** email and password, made by the admin. Turn on two-step sign-in: this role can record payments and reset accounts.

| Screen | Path | What you can do |
| --- | --- | --- |
| Events | `/secretariat` | **Add**, edit and delete events (age group, class, discipline, dances, solo or couple, kind: Beginners, Ranking, Inter-school, or Closed to a province). Search and filter by age group. Open an event to see its entries |
| An event | `/secretariat/events/:id` | See its entries; **Scratch** a dancer who withdraws and **Restore** before the event starts; add a **Late entry**; print the Heat list and Recall list |
| Competitors | `/secretariat/competitors` | **Add**, edit or delete a competitor (dancer and partner, team, province, coach, dates of birth, contact, beginner, membership year). **Import CSV** (entry-form columns). **Assign back numbers** to everyone, or set one by hand. Filter by competition, event and team. **Enter in events** on a row: pick the competition and events, see the fee and red warnings, choose how it was paid (cash, GCash, Maya, bank or **Not paid yet**), optionally add the coach's membership and Coaches Summit, and press **Enter** |
| Teams | `/secretariat/teams` | Add, edit and delete teams. A team with competitors cannot be deleted |
| Coaches | `/secretariat/coaches` | Add, edit and delete coaches, with the year their membership and the Coaches Summit were paid |
| Athletes | `/secretariat/athletes` | See athletes who made an account. **Confirm** a membership payment once the money arrives, or **turn it down** with a reason. **Reset password**, **delete** |
| Entry requests | `/secretariat/entry-requests` | Newest first. Open the payment screenshot, then **Approve** (enters the dancer and records the payment) or **Turn down** with a reason. The sender is told. A pop-up announces each new one |
| Account links | `/secretariat/account-links` | **Link** a coach or team account to its record, or turn it down |
| Team and coach changes | `/secretariat/profile-changes` | **Approve** or turn down (with a reason) an athlete's request to change their team or coach |
| Late entries | `/secretariat/late-entries` | **Add**, edit or delete a late entry (cash at the venue or not yet paid; an unpaid late entry cannot dance). On **Cash payments**, **mark** a team's unpaid or rejected payment as paid at the venue |
| Schedule | `/secretariat/schedule` | Put the events in running order |
| Program | `/secretariat/program` | Set the start time, **generate** the running order (rounds, breaks, the awarding) with minutes from the WDSF rules, **add breaks**, edit, move or remove a line, and print the program |
| Printouts | `/print` | The same sheets as the scrutineer, plus the program |
| Security | `/secretariat/security` | Turn on two-step sign-in, change your password |

**Limits:** cannot create competitions or staff, change fees, or run rounds. Can read the fee settings but not save them.

---

## Admin

**Device:** a laptop. **Account:** made once by whoever sets up the server (see [../operations/ROLE_ACCOUNTS.md](../operations/ROLE_ACCOUNTS.md)); make a second admin.

| Screen | Path | What you can do |
| --- | --- | --- |
| Competitions | `/admin/competitions` | **Create**, edit and delete competitions: name, date, venue, organizer, **Entries close**, **Fees due**, and the **card photo** (required). Search and filter by year. A competition with events cannot be deleted |
| Adjudicators and panels | `/admin/adjudicators` | **Add**, edit and delete adjudicators with a letter A to J. **Set or make a new PIN** for a competition, select adjudicators and **Print PIN cards** (PIN plus QR code), **Sign out everywhere** for a phone. Choose each event's **panel** in a grid of events by adjudicator |
| Points table | `/admin/points` | Edit the ranking points for each place |
| Payments | `/admin/payments` | See what each team owes and has paid, search and filter by status, open one to see what it covers and who recorded it. A read-only ledger |
| Fees and payment details | `/admin/fees` | Set the registration fees (first entry, each extra, ranking and inter-collegiate events, athlete and coach membership, Coaches Summit), the late-entry solo and couple fees, and the **payment accounts** (GCash, Maya, bank) people are shown when they pay |
| Staff accounts | `/admin/staff` | **Create** staff (secretariat, scrutineer, chairperson, MC, admin) with a temporary password shown once; edit, delete, **reset password**, **sign out everywhere**, **reset two-step sign-in**, and read each account's **activity** log |
| Security | `/admin/security` | Turn on two-step sign-in with an authenticator app (and save the recovery codes), change your password |
| Backups | top of every screen | A warning appears if a backup folder fails |

**Limits:** cannot start, approve or publish a round or confirm a tie (the scrutineer and chairperson do). The admin's menu also holds every screen the secretariat has (Events, Competitors, Teams, Coaches, Athletes, Entry requests, Account links, Team and coach changes, Late entries, Schedule, Program), under **Entries** and **The day**, so the admin can do all of the secretariat's work without a second account. The admin hears the same pop-ups as the secretariat.

---

## What every signed-in person has

- **Pop-up notifications** with a short sound, live: staff see alerts that are not kept (a new entry request, a new account link); athletes, coaches and teams see what is saved in their **Notifications**. On a laptop they appear bottom right and slide out to the right; on a phone or tablet they come across the top and slide up. Adjudicators and the MC get none.
- **Account page** for staff at `/account`: change your name and password and set up two-step sign-in.
- **Phone and tablet layout:** the same pages with a black header and a right-hand menu; the athlete, coach and team links become a strip under the navbar.
- **The server decides.** Every action is checked on the server against the role, so a hidden screen is not the only thing stopping someone: a role that is not on a function's list gets "Your account cannot do this."
