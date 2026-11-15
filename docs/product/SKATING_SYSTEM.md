# The Skating System for couples

How BIS places couples. The scoring engine (`packages/scoring`) follows this page; if the two ever disagree, fix the engine or this page, never one without the other.

Status: Rules 1, 2 and 5 to 11 were checked against the text of the Skating System (the Austrian federation's copy) and three published WDSF finals (see [ROADMAP.md](../build/ROADMAP.md)). The official rules end at **Rule 11**. There is no Rule 12 in that text.

## Words used

| Term | Meaning |
| --- | --- |
| Mark | What one adjudicator gives one couple in one dance: an X in a recall round, a place (1st, 2nd, 3rd …) in a final. A lower place is better. |
| Majority | More than half of the adjudicators: `floor(n / 2) + 1`. With 5 adjudicators it is 3, with 7 it is 4. |
| Column "1–k" | For each couple, the number of marks of **k or better**. Column 1 counts 1sts, column 1–2 counts 1sts and 2nds, column 1–3 counts 1st to 3rd, and so on up to the number of couples. |
| Sum | The marks added up. Used only to split couples with the same count. |
| Dance place | The place a couple gets in one dance of a multi-dance final. |

## Step 1: Recall rounds (Rule 1)

Every round before the final is marked with X marks.

1. The scrutineer says how many couples go through (the recall number).
2. Each adjudicator marks exactly that many couples with an X in each dance.
3. For each couple, add the X marks from all adjudicators and all dances of the round.
4. Rank by that total, highest first. The couples with the most X marks go through.
5. Couples level with the last couple that fits **all go through**. The number recalled can be higher than the recall number, for example 7 when 6 were asked for. There is no tie to decide.

Couples that are cut are ranked by their X totals, and equal totals share a range such as 7th–8th.

## Step 2: The final (Rule 2)

Each adjudicator places **every** couple, once each, from 1st to last, in every dance. Nobody can be given the same place twice by the same adjudicator.

## Step 3: One dance, place by place (Rules 5 to 8)

Places are given one at a time, starting with 1st. For the place being given, call it **k**:

1. Start at column **1–k** (the place being decided, not column 1). Count each couple that has not been placed yet.
2. **Majority (Rule 5).** A couple with a majority in that column is a candidate. If exactly one couple has a majority, it takes the place.
3. **Greater majority (Rule 6).** If several couples have a majority, the one with the **larger count** takes the place.
4. **Equal majority (Rule 7).** If the counts are equal, add up the marks counted in that column. The couple with the **lower sum** takes the place.
5. **No majority (Rule 8).** If nobody has a majority in column 1–k, move to the next column (1–k+1) and repeat from step 2, looking at the couples still unplaced.
6. **Still equal.** If the count and the sum are equal, look at the next column for those couples only. If they are level in every column to the last, they **share** the place and its average is used, for example two couples tied for 2nd share 2.5 and the next place is 4th.

Only the best couple takes the place. The others that also had a majority are weighed again for the next place, from their own column.

## Step 4: Several dances (Rules 9 to 11)

1. **Rule 9, add the dance places.** Place the couples in each dance with Step 3. Add each couple's dance places. The **lowest total** wins 1st, and so on down.
2. **Rule 10, equal totals, one place at a time.** For the place under review, take the couples tied for it. Count each couple's **dance places** that are that place **or better**. The couple with the **most** takes it. If those counts are equal, the **lower sum** of those dance places takes it.
3. **Rule 11, still equal.** Treat **every adjudicator's marks from every dance** as the marks of one single dance, and apply Steps 3 (Rules 5 to 8) to the tied couples to pick the best. The others go back to Rule 10 for the next place.
4. **Still equal after Rule 11.** The couples share the place and use the average.

A shared place counts as the **next whole place** when Rule 10 counts marks. A shared 2.5 counts as "3rd or better", not as "2nd or better", though it adds as 2.5.

## Worked example (5 adjudicators, majority 3)

Marks, adjudicators A to E:

| Couple | A | B | C | D | E | 1 | 1–2 | 1–3 | 1–4 | 1–5 | 1–6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 117 | 6 | 2 | 1 | 1 | 2 | 2 | 4 | 4 | 4 | 4 | 5 |
| 114 | 2 | 3 | 2 | 2 | 3 | 0 | 3 | 5 | 5 | 5 | 5 |
| 118 | 3 | 1 | 6 | 6 | 1 | 2 | 2 | 3 | 3 | 3 | 5 |
| 113 | 4 | 4 | 3 | 4 | 4 | 0 | 0 | 1 | 5 | 5 | 5 |
| 111 | 1 | 6 | 5 | 3 | 6 | 1 | 1 | 2 | 2 | 3 | 5 |
| 112 | 5 | 5 | 4 | 5 | 5 | 0 | 0 | 0 | 1 | 5 | 5 |

- **1st.** Column 1: nobody has 3. Column 1–2: 117 has 4 and 114 has 3. Both have a majority, 4 is greater, so **117** is 1st.
- **2nd.** From column 1–2, among those left: 114 has 3 (a majority), 118 has 2. **114** is 2nd.
- **3rd.** Column 1–3: 118 has 3, the others fewer. **118** is 3rd.
- **4th.** Column 1–4: 113 has 5. **113** is 4th.
- **5th.** Column 1–5: 112 has 5 and 111 has 3. Both have a majority, 5 is greater, so **112** is 5th.
- **6th.** **111**, the one left. It first reached a majority at column 1–5 (the ✓ on the sheet), but 112's greater majority took 5th.

## What the sheet shows

Each count column shows how many marks of that place or better. The ✓ goes on the **first column where a couple holds a majority**, which can come before the place is given. There is no overall "Total" on a one-dance sheet: the sum is only used inside Rule 7.

## Where this differs from the short notes that were pasted

| Pasted note | Official rule, and what BIS does |
| --- | --- |
| "Award each place to the couple with the highest Skating Total." | Each place is judged from its own column (1–k) onward, needs a majority, then greater majority, then lower sum, then the next column (Rules 5 to 8). |
| "Rule 10: compare how many marks are equal to or better than the tied position … at the next higher position." | Rule 10 counts a couple's **dance places** that are the place under review **or better**, then the lower sum of those. It applies only to a **multi-dance** final, after the totals of Rule 9 are equal. |
| "Rule 11: combine all marks of all dances and re-apply the full system." | This is right, and it is Rule 11. |
| "Rule 12: the lowest sum of all raw placement numbers across all judges and dances wins." | **Not an official rule.** After Rule 11 the couples share the place. BIS does not use a Rule 12. If you have the source for it, send it and it can be checked before anything changes. |

## Where it lives in the code

- Recall rounds, Rule 1: `packages/scoring/src/callback.ts`
- One dance, Rules 5 to 8, and the sheet's ticks: `packages/scoring/src/skating.ts`
- Several dances, Rules 9 to 11: `packages/scoring/src/final.ts`
- Cut-off ranges for couples cut before the final: `packages/scoring/src/eliminated.ts`
- Tests with the numbers above: `packages/scoring/src/*.test.ts`
