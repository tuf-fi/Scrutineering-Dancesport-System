# Pilot plan

The pilot runs BIS at a real competition while the current method (paper sheets and the usual scoring) runs alongside it. The paper result stays the official one. BIS is trusted only after its results match the paper's, and after the people running it say it was easier, not harder.

## Choose the competition

- A small or medium one, with the organizer's agreement, and not the biggest event of the year.
- Venue with working power outlets and Wi-Fi coverage for the whole floor.
- At least one person who has run the current method, to produce the paper result.

## Four weeks before

- [ ] Online server running on its real address (deploy/README.md). Admin account created, fees and payment details entered.
- [ ] Facebook Page and Meta app set up if Messenger is wanted; one club account tested end to end.
- [ ] Competition created online. Clubs told how to register and pay; the privacy notice read by whoever speaks to the clubs.
- [ ] Adjudicators created with their letters, panels set, PINs printed.
- [ ] Real result sheets from a past competition typed into a CSV and compared (below), to catch scoring differences before the day.

## One week before

- [ ] On Laptop 2, with internet: download the competition (Cloud sync). Check the number of paid entries against the online list.
- [ ] `pnpm rehearsal` and `pnpm loadtest` pass on Laptop 2 and Laptop 3.
- [ ] Run the by-hand rehearsal in VENUE.md on the real phones, including airplane mode and a phone that is switched off in the middle of a round.
- [ ] Plug in both backup drives and check that a backup appears after a change.
- [ ] Back numbers assigned and printed; printed blank mark sheets in the bag in case a phone fails.

## On the day

- [ ] Set up the Wi-Fi, start the server, sign in the staff, and check the Cloud sync screen shows connected.
- [ ] Every adjudicator signs in with a PIN on their own phone before the first round.
- [ ] Paper sheets are filled in as usual by the people who normally do it. They do not look at BIS until a round is published.
- [ ] After every published round, one person notes anything that surprised them: time to approve, a screen that confused someone, a phone that needed help.
- [ ] If BIS fails, switch to paper for that round and write down what happened. The competition does not wait for BIS.

## Afterwards

1. Type the paper placings into a CSV (`event,place,back_number`, one line per placed dancer) and run:
   `pnpm --filter @bis/backend results:compare <competition id> paper.csv`
2. Every difference is looked at by hand: a typing mistake on the sheet, a rule applied differently, or a BIS fault. Write down which.
3. Check Cloud sync says nothing is waiting, then release the competition. Look at the public results page on a phone.
4. Ask each role what slowed them down and what they would change.

## Ready to use for real

BIS replaces paper only when all of these are true:

- Every difference with the paper is explained, and none was a scoring fault.
- No mark was lost, and no phone needed more than one try to send.
- Approving a round took no longer than the current method.
- Results appeared on the public page within a minute of publishing, once the internet was there.
- Scrutineer, secretariat and chairperson each say they would use it again.

## If it goes wrong

| What happened | Do this |
| --- | --- |
| A phone cannot send | Marks are kept on the phone and sent when it can. The scrutineer can type them in from the paper sheet (Paper marks). |
| The server stops | Restart it. If it will not start, take over on Laptop 3 (VENUE.md). |
| Wi-Fi fails | Phones keep their marks; use a phone as a hotspot or move the router. Nothing needs the internet. |
| The cloud cannot be reached | Carry on. Changes wait and are sent later. |
| BIS and paper disagree on the day | Paper is official. Keep the BIS result and note the difference for the comparison. |
