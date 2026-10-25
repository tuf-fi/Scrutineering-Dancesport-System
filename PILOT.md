# Pilot plan

The pilot runs BIS at a real competition while the current method (paper sheets and the usual scoring) runs alongside it. The paper result stays the official one. BIS is trusted only after its results match the paper's, and after the people running it say it was easier, not harder.

## Choose the competition

- A small or medium one, with the organizer's agreement, and not the biggest event of the year.
- Venue with working power outlets and a dependable internet connection (or good mobile coverage) across the whole floor.
- At least one person who has run the current method, to produce the paper result.

## Four weeks before

- [ ] Online server running on its real address (deploy/README.md). Admin account created, fees and payment details entered.
- [ ] Facebook Page and Meta app set up if Messenger is wanted; one club account tested end to end.
- [ ] Competition created online. Clubs told how to register and pay; the privacy notice read by whoever speaks to the clubs.
- [ ] Adjudicators created with their letters, panels set, PINs printed.
- [ ] Real result sheets from a past competition typed into a CSV and compared (below), to catch scoring differences before the day.

## One week before

- [ ] Check the number of paid entries against the list of approved payments.
- [ ] Rehearse against the real online server: `pnpm rehearsal` and `pnpm loadtest`, then the same by hand with real phones on mobile data and real laptops, including airplane mode and a phone that is switched off in the middle of a round.
- [ ] Check the server's clock, set `ADJUDICATOR_PIN_DAYS`, and check that a backup appears after a change (deploy/README.md, Before a competition).
- [ ] Back numbers assigned and printed; printed blank mark sheets in the bag in case a phone fails.

## On the day

- [ ] Open the site on every laptop, sign in the staff, and check there is no backup warning at the top of the screen.
- [ ] Every adjudicator signs in with a PIN on their own phone before the first round.
- [ ] Paper sheets are filled in as usual by the people who normally do it. They do not look at BIS until a round is published.
- [ ] After every published round, one person notes anything that surprised them: time to approve, a screen that confused someone, a phone that needed help.
- [ ] If BIS fails, switch to paper for that round and write down what happened. The competition does not wait for BIS.

## Afterwards

1. Type the paper placings into a CSV (`event,place,back_number`, one line per placed dancer) and run:
   `pnpm --filter @bis/backend results:compare <competition id> paper.csv`
2. Every difference is looked at by hand: a typing mistake on the sheet, a rule applied differently, or a BIS fault. Write down which.
3. Look at the public results page on a phone.
4. Ask each role what slowed them down and what they would change.

## Ready to use for real

BIS replaces paper only when all of these are true:

- Every difference with the paper is explained, and none was a scoring fault.
- No mark was lost, and no phone needed more than one try to send.
- Approving a round took no longer than the current method.
- Results appeared on the public page within a minute of publishing.
- Scrutineer, secretariat and chairperson each say they would use it again.

## If it goes wrong

| What happened | Do this |
| --- | --- |
| A phone cannot send | Marks are kept on the phone and sent when it can. The scrutineer can type them in from the paper sheet (Paper marks). |
| The server stops | It restarts by itself (`restart: unless-stopped`). If it will not come back, restore the newest backup (deploy/README.md) and use paper meanwhile. |
| A connection fails | Phones keep their marks and resend them. Switch the phone between mobile data and Wi-Fi, or use another phone as a hotspot. |
| BIS and paper disagree on the day | Paper is official. Keep the BIS result and note the difference for the comparison. |
