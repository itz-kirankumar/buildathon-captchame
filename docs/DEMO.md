# Stakeholder demo: "one person, many accounts"

A ten-minute demo that uses only your own running product and invented visitors. It shows the idea, the proof, and
the honest gaps. It contains no attack technique.

## The story in three sentences

1. CaptchaMe checks that a live person, or a declared agent, is present.
2. A person can still make many accounts, so a cap on each account is not enough.
3. The second layer (abuseguard) caps what **one person** can use across every account linked to them, explains each
   block, and lets a wrongly blocked person appeal.

## Setup (about 5 minutes)

You need Node 22 and the abuseguard 0.4.0 package. Use two terminals.

```bash
# terminal 1: abuseguard
cd abuseguard-0.4.0 && AG_API_KEYS="captchame:demo-key" PORT=8787 npm start
```

```bash
# terminal 2: CaptchaMe with the second layer on and enforcing
POP_ADMIN_KEY=demo ABUSEGUARD_URL=http://127.0.0.1:8787 ABUSEGUARD_KEY=demo-key ABUSEGUARD_SALT=any-secret \
ABUSEGUARD_MODE=enforce ABUSEGUARD_STRICTNESS=strict npm start
```

Details and every setting are in `docs/ABUSEGUARD.md`.

## The flow

| Minute | Show | Say |
|---|---|---|
| 0-2 | `/check` | "Most people never see a check. A form fills in and passes." |
| 2-4 | `npm run demo:farm` | Four visitors share one browser. The ledger alone allows all of them. The cap follows the person, so later visitors, even a brand-new one that spent nothing, are stopped. |
| 4-5 | The 429 reply | "Named reasons, a retry time, recovery paths. Never a silent block." |
| 5-6 | `/appeal`, then approve in `/dashboard` | "A human can overturn it. The console feed shows the alert." |
| 6-7 | Stop abuseguard and call the API again | "If the second layer is down, customers are still served. It fails open." |
| 7-10 | `docs/VALIDATION-PLAN.md`, section 3 | The honest numbers and gaps. See below. |

What `npm run demo:farm` prints on the verified run:

- Visitors 1 and 2 are served 4 calls each, USD 0.40 each, under the USD 0.50 own cap.
- Visitors 3 and 4 are stopped by abuseguard, with USD 0 spent, because the browser they share had already used one person's share.
- A fifth visitor is limited with `DEVICE_CLUSTER, COST_OVER_BUDGET`.

Which visitor is stopped first depends on report timing (usage is reported every 2 seconds). Do not promise an exact row.

## The honest slide (say this before they ask)

These are measured on real public data, with person-level intervals. They make the plan credible.

| What | Measured |
|---|---|
| Humans passing the typing check | 99.5%. Person-level false alarm 0.5% (0.0 to 1.2) across 51 typists |
| Phone users not given the invisible pass | 6.1% (CI 2.8 to 12.7), against about 0% on desktop |
| Real people failing the colour-clash window | 1.7% (CI 0.9 to 2.6) across 81 people |
| Typing check against random timing jitter | Does not stop it. It stops only constant timing |
| Pointer shape as proof of a person | Does not separate the four bot generators we tested |
| Checks with no public data (ring, targets, flash, pulse, beat, voice, button check) | Not validated yet |

The message for stakeholders: the checks are a speed bump that raises cost. The cap on one person's total use is what
limits the damage. That is why the second layer is worth building.

## What this demo does not prove

- It does not prove that a real AI agent fails or passes your checks. Nobody has measured that yet. Treat any claim either way as unproven.
- The attackers here are invented visitors that share a browser id. They show the cap, not an attack.
- abuseguard's own Docker file and Postgres adapter were not run by us.

## How to find out about real agents without a security team

You do not need to attack your own product to learn this. Two low-cost routes:

1. **Ask real people to try it** and record pass and fail with the calibration mode (to be built). This fills the biggest gap: there is no public data for your own tasks.
2. **Watch the live traffic you already get.** Run the audit on your access logs (`/audit`) and the shield on `/scraper`. Real agents and crawlers show up there, labelled by what they claim to be.

If you later want a hostile test, ask a trusted outside tester under a written scope. I cannot write one for you.

## Scaling plan (what is known, and what is not)

Known from the code and docs:

1. Run abuseguard as **one long-running service**. Its live statistics sit in one process. Do not put it inside serverless functions.
2. CaptchaMe's own replay tracking and ledger are in memory per instance. Move them to a shared store before you run several instances.
3. Roll out in steps: `watch` (record only), then `gentle`, then `strict`. Stop and go back to `watch` if more than 1% of paying users are limited, or if appeals wait more than 24 hours.
4. Use the shadow counters `agree`, `abuseguardStricter`, and `ledgerStricter` at `GET /api/admin/abuseguard` to see where the layers differ before you enforce anything.

Not known: cost per request at volume, and behaviour with several abuseguard instances. Measure both in a pilot before you quote numbers.
