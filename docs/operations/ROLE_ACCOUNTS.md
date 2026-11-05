# BIS role accounts

How the accounts of the system are made, who makes them, and how to keep them safe. Start with the Admin; the Admin makes everyone else.

Staging and production start the same way: an Admin and a Secretariat, nothing else. The sample accounts are never loaded on either (the server refuses).

## Order

1. **Admin**: made once, by whoever sets up the server.
2. **Secretariat, Scrutineer, Chairperson, compere**: made by the Admin on the **Staff** screen.
3. **Adjudicators**: no account. The Admin adds each adjudicator and prints a six-digit PIN for each competition.
4. **Athletes, coaches and teams**: make their own account on the public site. The secretariat links coach and team accounts to their record.

## Who gets what

| Role | Made by | Signs in with | Does |
| --- | --- | --- | --- |
| Admin | Server setup (once) | Email and password, plus a code from the authenticator app once it is turned on | Staff accounts, adjudicators and PINs, fees, payments, security, competitions |
| Secretariat | Admin | Email and password, plus a code from the authenticator app once it is turned on | Teams, competitors, entries, entry requests, account links, team and coach changes, schedule, program |
| Scrutineer | Admin | Email and password | Runs the rounds and checks the marks |
| Chairperson | Admin | Email and password | Reviews and signs off the rounds |
| Compere | Admin | Email and password | Announcing screen |
| Adjudicator | Admin (adds the person and prints the PIN) | Six-digit PIN | Marks on a phone |
| Athlete, coach, team | Themselves | Email and password | Their own page, entries and payments |

Staff sign in at `/staff-access`. The page is not linked from the public site.

## 1. Make the Admin

Run once on the server, with the real email and name of the person who will own the system:

```
docker compose exec app node_modules/.bin/tsx src/db/create-admin-cli.ts <email> "<Full name>"
```

It prints a temporary password once. Give it to that person in private, not by email or chat in plain text.

Then the Admin:

1. Signs in at `/staff-access` and changes the password.
2. Turns on two-step sign-in (Security) and saves the recovery codes somewhere safe, offline.
3. Makes a second Admin, so one lost phone does not lock everyone out.

## 2. Make the other staff

The Admin opens **Staff**, adds a person with their own work email and a role, and the system shows a temporary password once. Hand it over in private. The person changes it at first sign-in.

Fill this in and keep it with the Admin. Do not write passwords in it.

| Role | Name | Email | Created on | Two-step on |
| --- | --- | --- | --- | --- |
| Admin | | | | |
| Admin (second) | | | | |
| Secretariat | | | | |
| Scrutineer | | | | |
| Chairperson | | | | |
| Compere | | | | |

## 3. Adjudicators

The Admin adds each adjudicator and a letter (A to J), then generates the PINs for the competition on **Adjudicators and panels**. A new PIN signs the old phone out. Print the PIN cards, hand each to its adjudicator at the venue, and collect or destroy them after the competition.

## Rules

- **One person, one account.** No shared logins.
- **Passwords are never stored as typed.** They are salted and hashed (scrypt). Nobody, including the Admin, can read one back, only reset it.
- **Hand over temporary passwords in private** and expect them to be changed at once.
- **Turn on two-step sign-in for Admin and Secretariat.** They can approve payments and reset accounts. The system does not force it yet, so the Admin checks it is on for each of them.
- **When someone leaves,** the Admin deletes their account, or uses **Signed out everywhere** if they only lose a device.
- **Never use the sample accounts** from `TEST_ACCOUNTS.md` on the real server. Their password is public.
- **Authenticator secrets are encrypted** with `DATA_KEY`, which is set in the server's `.env`, not in the database. Keep a copy of it outside the server. If it is lost, staff set up two-step sign-in again.
- **Keep the server on HTTPS only** and the cookie secret and `DATA_KEY` out of Git and chat.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| A person forgot their password | Admin resets it on **Staff**; they get a new temporary password |
| An Admin lost their phone | Another Admin turns off their two-step sign-in, then they set it up again. Or they use a recovery code |
| A PIN is refused | Admin generates a new one on **Adjudicators and panels** |
| "Wrong PIN tried" alert | Someone entered a PIN that is not registered. Check it was not an adjudicator mistyping |
| "Recovery code used" alert | Confirm with that person that it was them |
