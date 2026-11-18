'use strict';
// Stakeholder demo: one person, many accounts. Defensive only: it uses nothing but plain HTTP calls to YOUR OWN
// running CaptchaMe, from invented anonymous visitors that share one browser id.
//
//   Start CaptchaMe with abuseguard on (see docs/DEMO.md), then:  node scripts/demo-farm.js
//
// What it shows: no visitor passes CaptchaMe's own per-visitor cap, so the ledger alone allows all of them.
// Together they use more than one person's fair share, so abuseguard stops later visitors on that browser, and
// also a brand-new one that has spent nothing. Which visitor gets stopped first depends on report timing.
const BASE = process.env.BASE || 'http://localhost:3000';
const BROWSER = 'demo-browser-' + Math.random().toString(36).slice(2, 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function quote(cookie) {
  const r = await fetch(BASE + '/api/protected/quote', { headers: { cookie, 'user-agent': 'Mozilla/5.0 (demo)' } });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, body: b, setCookie: r.headers.get('set-cookie') || '' };
}

(async () => {
  console.log(`Demo against ${BASE}. Shared browser id: ${BROWSER}\n`);
  const rows = [];
  for (let visitor = 1; visitor <= 4; visitor++) {
    const first = await quote('cm_vid=' + BROWSER);
    const m = /pop_actor=([^;]+)/.exec(first.setCookie);
    if (!m) { console.log('Could not start a visitor. Is the server running at ' + BASE + '?'); process.exit(1); }
    const cookie = `cm_vid=${BROWSER}; pop_actor=${m[1]}`;
    const results = [first];
    for (let i = 0; i < 3; i++) results.push(await quote(cookie));
    const served = results.filter(r => r.status === 200).length;
    const stop = results.find(r => r.status !== 200);
    rows.push({
      visitor, 'calls tried': results.length, served,
      'own spend (USD)': (served * 0.1).toFixed(2),
      'stopped by': stop ? (stop.body.source === 'abuseguard' ? 'abuseguard (shared browser)' : 'CaptchaMe ledger (own cap)') : '-',
    });
  }
  console.log('Step 1. Four visitors on one browser, each trying 4 calls. A visitor\'s own cap is USD 0.50:');
  console.table(rows);
  console.log('Read it this way: the ledger alone would allow every row, because no visitor passes USD 0.50.');
  console.log('A visitor shown as stopped by abuseguard was stopped because the earlier visitors on the same browser had already used one person\'s share.\n');

  console.log('Waiting 3 s for the usage report to reach abuseguard...');
  await sleep(3000);

  const probe = await quote('cm_vid=' + BROWSER);
  console.log('\nStep 2. A FIFTH visitor on the same browser, who has spent nothing:');
  if (probe.status === 429 && probe.body.source === 'abuseguard') {
    console.log(`  Result : limited (HTTP ${probe.status})`);
    console.log(`  Reasons: ${(probe.body.reasons || []).join(', ')}`);
    console.log(`  Message: ${probe.body.reason}`);
    console.log(`  Next   : ${(probe.body.recovery && probe.body.recovery.paths || []).join(', ')}   decision id ${probe.body.decision_id}`);
    console.log('\nThe cap followed the person, not the account. That is the point of the second layer.');
  } else {
    console.log(`  Result : HTTP ${probe.status}, served. abuseguard did not limit this visitor.`);
    console.log('  Check: ABUSEGUARD_URL/KEY/SALT are set, ABUSEGUARD_MODE=enforce, ABUSEGUARD_STRICTNESS=strict,');
    console.log('         and GET /api/admin/abuseguard shows enabled: true. In shadow mode this is the expected result.');
  }
})().catch(e => { console.error('Demo failed:', e.message); process.exit(1); });
