/**
 * Standalone, self-contained HTML summary of a run — shareable without the
 * Playwright report's asset directory. Mirrors the sibling Playright suite's
 * scripts/generate-auth-report-html.js, grouped by area with a filter bar and
 * the known-vulnerability register surfaced at the top.
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.resolve(process.cwd(), 'test-results/e2e-results.json');
const outputPath = path.resolve(process.cwd(), 'test-results/e2e-report.html');

function collectSpecs(suites, acc = []) {
  if (!Array.isArray(suites)) return acc;
  for (const suite of suites) {
    if (Array.isArray(suite.specs)) acc.push(...suite.specs);
    if (Array.isArray(suite.suites)) collectSpecs(suite.suites, acc);
  }
  return acc;
}

const stripAnsi = (s) => String(s == null ? '' : s).replace(/\x1B\[[0-9;]*m/g, '');
const esc = (s) =>
  stripAnsi(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '0ms';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function firstError(result) {
  if (!result) return '';
  if (result.error && result.error.message) return result.error.message.split('\n')[0];
  if (Array.isArray(result.errors) && result.errors.length) {
    return String(result.errors[0].message || result.errors[0].value || '').split('\n')[0];
  }
  return '';
}

/**
 * Derive the area from the spec path.
 *
 * Playwright's JSON reporter emits `file` relative to `testDir` (`api/auth/auth.api.spec.ts`),
 * NOT relative to the package root — so a leading `tests/` is optional, and a top-level file
 * like `global.setup.ts` has no directory at all.
 */
function areaOf(file) {
  const path = String(file).replace(/\\/g, '/').replace(/^tests\//, '');
  const m = /^(?:e2e\/)?([^/]+)\//.exec(path);
  if (m) return m[1];
  return /global\.(setup|teardown)/.test(path) ? 'harness' : 'other';
}

function caseIdOf(title) {
  const m = /\b([A-Z][A-Z0-9]{1,9}(?:-[A-Z]+)?-[PNESAV]-\d{1,3}|SEC-\d{1,3})\b/.exec(String(title));
  return m ? m[1] : '';
}

const CLASS = {
  passed: 'pass',
  expected: 'pass',
  failed: 'fail',
  unexpected: 'fail',
  timedOut: 'fail',
  skipped: 'skip',
  flaky: 'flaky',
};
const LABEL = { passed: 'PASS', expected: 'PASS', failed: 'FAIL', unexpected: 'FAIL', timedOut: 'TIMEOUT', skipped: 'SKIP', flaky: 'FLAKY' };

function build(data) {
  const rows = [];
  for (const spec of collectSpecs(data.suites || [])) {
    for (const test of spec.tests || []) {
      const results = test.results || [];
      const last = results[results.length - 1] || {};
      const annotations = [...(test.annotations || []), ...(spec.annotations || [])];
      const vuln = annotations.find((a) => a.type === 'known-vulnerability');
      rows.push({
        id: caseIdOf(spec.title) || caseIdOf(test.title),
        title: spec.title || test.title || 'Unnamed test',
        file: spec.file || 'unknown',
        area: areaOf(spec.file),
        project: test.projectName || '',
        status: test.status || last.status || 'unknown',
        duration: formatDuration(results.reduce((n, r) => n + (r.duration || 0), 0)),
        reason: firstError(last),
        vulnerability: vuln ? vuln.description : '',
      });
    }
  }

  const n = (pred) => rows.filter(pred).length;
  const totals = {
    total: rows.length,
    passed: n((r) => CLASS[r.status] === 'pass'),
    failed: n((r) => CLASS[r.status] === 'fail'),
    skipped: n((r) => r.status === 'skipped'),
    flaky: n((r) => r.status === 'flaky'),
  };
  const vulns = rows.filter((r) => r.vulnerability);
  const areas = [...new Set(rows.map((r) => r.area))].sort();

  const tableRows = rows
    .map(
      (r) => `<tr data-status="${CLASS[r.status] || 'info'}" data-area="${esc(r.area)}">
      <td><span class="badge ${CLASS[r.status] || 'info'}">${LABEL[r.status] || 'INFO'}</span></td>
      <td class="mono">${esc(r.id)}</td>
      <td>${esc(r.title)}${r.vulnerability ? `<div class="vuln">🔓 ${esc(r.vulnerability)}</div>` : ''}</td>
      <td class="mono dim">${esc(r.area)}</td>
      <td class="mono dim">${esc(r.project)}</td>
      <td class="num dim">${esc(r.duration)}</td>
      <td class="dim">${esc(r.reason)}</td>
    </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Utsava E2E — Test Report</title>
<style>
  :root { --bg:#0b0f14; --panel:#131a22; --line:#243040; --fg:#e6edf3; --dim:#8b98a8;
          --pass:#3fb950; --fail:#f85149; --skip:#8b98a8; --flaky:#d29922; --accent:#d4af37; }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f7f8fa; --panel:#fff; --line:#e2e6eb; --fg:#1a1f26; --dim:#5a6572; }
  }
  * { box-sizing:border-box }
  body { margin:0; padding:2rem 1.25rem 4rem; background:var(--bg); color:var(--fg);
         font:14px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif }
  .wrap { max-width:1400px; margin:0 auto }
  h1 { margin:0 0 .25rem; font-size:1.6rem; letter-spacing:-.02em }
  h2 { margin:2.25rem 0 .75rem; font-size:1.05rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dim) }
  .sub { color:var(--dim); margin:0 0 1.5rem }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:.75rem }
  .tile { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:1rem }
  .tile .k { color:var(--dim); font-size:.75rem; text-transform:uppercase; letter-spacing:.07em }
  .tile .v { font-size:1.9rem; font-weight:600; font-variant-numeric:tabular-nums; line-height:1.1 }
  .v.pass{color:var(--pass)} .v.fail{color:var(--fail)} .v.skip{color:var(--skip)} .v.flaky{color:var(--flaky)}
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden }
  .scroll { overflow-x:auto }
  table { border-collapse:collapse; width:100%; min-width:900px }
  th,td { padding:.55rem .7rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:top }
  th { position:sticky; top:0; background:var(--panel); font-size:.72rem; text-transform:uppercase;
       letter-spacing:.07em; color:var(--dim); z-index:1 }
  tr:last-child td { border-bottom:0 }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.82rem }
  .dim { color:var(--dim) }
  .num { text-align:right; font-variant-numeric:tabular-nums }
  .badge { display:inline-block; padding:.1rem .45rem; border-radius:5px; font-size:.7rem; font-weight:700;
           letter-spacing:.04em; border:1px solid }
  .badge.pass{color:var(--pass);border-color:color-mix(in srgb,var(--pass) 40%,transparent)}
  .badge.fail{color:var(--fail);border-color:color-mix(in srgb,var(--fail) 40%,transparent)}
  .badge.skip{color:var(--skip);border-color:var(--line)}
  .badge.flaky{color:var(--flaky);border-color:color-mix(in srgb,var(--flaky) 40%,transparent)}
  .badge.info{color:var(--dim);border-color:var(--line)}
  .vuln { color:var(--flaky); font-size:.78rem; margin-top:.2rem }
  .filters { display:flex; gap:.4rem; flex-wrap:wrap; margin:0 0 .75rem }
  .filters button { background:var(--panel); color:var(--fg); border:1px solid var(--line);
    border-radius:999px; padding:.3rem .8rem; font-size:.8rem; cursor:pointer }
  .filters button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent) }
  .empty { padding:1.25rem; color:var(--dim) }
</style></head>
<body><div class="wrap">
  <h1>Utsava E2E — Test Report</h1>
  <p class="sub">${esc(process.env.GITHUB_SHA ? `commit ${process.env.GITHUB_SHA.slice(0, 7)}` : 'local run')} · ${totals.total} cases</p>

  <div class="tiles">
    <div class="tile"><div class="k">Total</div><div class="v">${totals.total}</div></div>
    <div class="tile"><div class="k">Passed</div><div class="v pass">${totals.passed}</div></div>
    <div class="tile"><div class="k">Failed</div><div class="v fail">${totals.failed}</div></div>
    <div class="tile"><div class="k">Skipped</div><div class="v skip">${totals.skipped}</div></div>
    <div class="tile"><div class="k">Flaky</div><div class="v flaky">${totals.flaky}</div></div>
  </div>

  <h2>Known vulnerability register</h2>
  <div class="panel">${
    vulns.length
      ? `<div class="scroll"><table><thead><tr><th>Status</th><th>Case</th><th>Finding</th><th>File</th></tr></thead><tbody>${vulns
          .map(
            (r) => `<tr><td><span class="badge ${CLASS[r.status] || 'info'}">${LABEL[r.status] || 'INFO'}</span></td>
        <td class="mono">${esc(r.id)}</td><td>${esc(r.vulnerability)}</td><td class="mono dim">${esc(r.file)}</td></tr>`,
          )
          .join('')}</tbody></table></div>
       <div class="empty">A <strong>FAIL</strong> row is expected — the vulnerability is still present.
       A <strong>PASS</strong> row means it was fixed: remove the <code>test.fail()</code> wrapper and the annotation.</div>`
      : '<div class="empty">None. Every security case asserts and meets its secure expectation.</div>'
  }</div>

  <h2>All test cases</h2>
  <div class="filters" id="filters">
    <button data-f="all" aria-pressed="true">All</button>
    <button data-f="fail" aria-pressed="false">Failed</button>
    <button data-f="skip" aria-pressed="false">Skipped</button>
    <button data-f="flaky" aria-pressed="false">Flaky</button>
    ${areas.map((a) => `<button data-area="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join('')}
  </div>
  <div class="panel scroll">
    <table><thead><tr>
      <th>Status</th><th>Case</th><th>Test</th><th>Area</th><th>Project</th><th>Duration</th><th>Result Reason</th>
    </tr></thead><tbody id="rows">
${tableRows}
    </tbody></table>
  </div>
</div>
<script>
  const bar = document.getElementById('filters');
  const rows = [...document.querySelectorAll('#rows tr')];
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    [...bar.querySelectorAll('button')].forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const status = btn.dataset.f, area = btn.dataset.area;
    rows.forEach((r) => {
      const show = area ? r.dataset.area === area : (!status || status === 'all' || r.dataset.status === status);
      r.style.display = show ? '' : 'none';
    });
  });
</script>
</body></html>`;
}

try {
  if (!fs.existsSync(resultsPath)) throw new Error(`Playwright JSON results not found at ${resultsPath}`);
  const html = build(JSON.parse(fs.readFileSync(resultsPath, 'utf-8')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
  console.log(`HTML report written to ${outputPath}`);
} catch (error) {
  console.error(`Failed to generate the HTML report: ${error.message}`);
  process.exit(1);
}
