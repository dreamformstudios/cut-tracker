# Cut Tracker

A calorie, macro and weight tracker built around one job: staying in a deficit until
you hit your goal weight.

**→ Start with [SETUP.md](SETUP.md).** Step 1 gets it running in about ten minutes.

## What it does

- **Log food by meal** — breakfast, lunch, dinner, snacks, each with its own calorie
  subtotal. Search ~200 built-in foods, or several hundred thousand once the USDA key
  is in.
- **Exercise adds to your budget.** Log a 600-calorie workout and you get 600 more
  calories to eat that day while hitting the same deficit. Everyday movement is
  already inside your base burn, so only intentional exercise goes here.
- **Recents, favorites and saved meals.** The foods you eat constantly are one tap
  away. "Copy yesterday" duplicates a whole day. "Save as meal" turns a day into a
  reusable template.
- **A Weight tab** with its own weigh-in box, the full history of every weigh-in
  (editable — fix a typo, backfill a day you missed, delete a bad reading), the trend
  chart, and the projection. Today prompts you when you haven't weighed in yet.
- **A real projection.** Once there are two weigh-ins a week apart it stops trusting
  the plan and starts projecting from what is actually happening.
- **Streaks and a weekly rollup** — this week's average intake, deficit and weight
  change against last week's, plus what your logged deficit *predicts* you should have
  lost. When those two disagree, the scale is right.
- **Works offline** and installs to your phone's home screen.
- **Syncs across devices** through your own private Supabase database.

## The math

Base burn uses Mifflin–St Jeor for resting metabolism, multiplied by your activity
setting. Daily deficit is your chosen rate × 3,500 ÷ 7. Protein is set per pound of
*goal* weight (not current) because that is what protects muscle while cutting; fat is
a share of calories; carbs take the remainder.

Intake never drops below 1,500 cal/day for men or 1,200 for women — if your chosen
pace would push it lower, the app holds the floor and tells you.

None of this is medical advice, and the formulas are estimates: your real maintenance
can sit a few hundred calories either side. That is exactly why the projection switches
to your measured rate as soon as it has enough weigh-ins.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `app.js` | All logic — math, rendering, search, sync |
| `foods.js` | The built-in food database |
| `styles.css` | Styling |
| `config.js` | **The only file you edit** — your API keys |
| `sw.js` | Service worker: offline support |
| `supabase-schema.sql` | Database setup, paste into Supabase once |

## Your data

Everything lives in your browser first, and the app is fully usable with no accounts
at all. If you set up sync, a copy also goes to a Supabase project that you own, with
row-level security so only your login can read it. Nothing is sent anywhere else. The
USDA lookup sends only your search text.

Settings → Data → Download backup writes the whole thing to a JSON file whenever you
want one.
