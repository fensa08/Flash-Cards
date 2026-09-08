# Learning Effectiveness KPIs

KPIs for measuring whether the spaced-repetition algorithm is actually working, tied to the SM-2 fields (`easeFactor`, `intervalDays`, `dueAt`) planned in MODERNIZATION_PLAN.md.

## 1. Retention rate (the core metric)

- % of reviews graded "correct/know" vs. total reviews, in a given window.
- Break down by interval bucket (retention on 1-day-interval cards vs. 30-day cards) — tells you if the algorithm's spacing is calibrated. Flat retention across all buckets around 85-90% is the SM-2 target. If short-interval cards have much lower retention than long-interval ones, something's off with initial ease settings.

## 2. Lapse rate

- % of reviews on "mature" cards (interval ≥ threshold, e.g. 21 days) that come back wrong.
- High lapse rate on mature cards signals algorithm miscalibration or bad card writing (ambiguous questions), not a memory problem.

## 3. Ease factor distribution / drift

- Average `easeFactor` across all cards, and its trend over time.
- Cards pinned at the minimum ease floor (typically 1.3 in SM-2) — a growing pile here means those cards are essentially broken and should be flagged for rewriting, not endlessly re-reviewed.

## 4. Time/reviews-to-maturity

- Median number of reviews (or days) for a card to cross from "new" to "mature" interval.
- Lets you compare across decks — a deck where cards take 3x longer to mature suggests content is too hard or poorly atomized (multi-fact cards).

## 5. Review accuracy vs. self-reported difficulty

- If grading UI has more than binary (Again/Hard/Good/Easy), track grade distribution over time per card.
- A card oscillating between Again and Easy repeatedly indicates inconsistent recall (memory not sticking). A card trending toward Easy consistently is over-scheduled and could have longer intervals.

## 6. Backlog-adjusted retention

- Retention rate specifically on overdue cards (reviewed after `dueAt` passed) vs. on-time cards.
- Overdue reviews naturally score worse; conflating the two masks whether the algorithm or the user's review discipline is the problem.

## Starting point

Given the app is still single-user, instrument #1 (retention by interval bucket) and #2 (lapse rate on mature cards) first. These two are the clearest signal of whether the SM-2 implementation is working correctly, and both are computable directly from a `reviews` log collection (`cardId`, `timestamp`, `grade`, `intervalAtReview`) without needing aggregation infrastructure.
