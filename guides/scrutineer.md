# Scrutineer guide

You run the rounds from Laptop 2. Keep its window open all day.

## Before the first round
- `http://localhost:4000/api/health` says ok. No warning about a backup folder or the cloud at the top of the screen.
- **Rounds**: press **Plan rounds** once. Every event gets its rounds.
- Every adjudicator is signed in on a phone. Blank paper sheets are printed (**Paper marks**, print blank sheets).

## Each round
1. **Rounds**: choose the round, press **Start round**. It appears on the phones. If every entry in the event is not paid, it will not start; the message says how many.
2. **Live board**: watch each phone go from waiting to submitted. A phone quiet for 20 seconds is flagged. "Marks saved on the phone, not sent yet" means it has them and is waiting for Wi-Fi.
3. **Recall** (early rounds) or **Results** (final): check the table. A tie at the cut-off: pick how to settle it, press **Propose decision**, and the chairperson presses **Confirm tie decision**.
4. **Approve**, then **Publish results**. Approving saves the result, the ranking points and a backup. Publishing makes it public and shows it to the MC.

## Problems
- **Wrong round started:** **Take off the floor**, possible until a phone has submitted.
- **A phone cannot send:** **Paper marks**, choose the adjudicator, type the paper sheet, confirm.
- **This laptop stops:** run `pnpm venue` again. Nothing saved is lost. If it will not start, Laptop 3 takes over (VENUE.md).
- **Cloud notice:** results are safe here and go up when the internet is back.
