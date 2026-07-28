/**
 * Turns Playwright's JSON reporter output into a reviewable markdown summary.
 *
 * Mirrors the convention from the sibling Playright suite
 * (scripts/generate-auth-report.js), with three additions this suite needs:
 *   - grouping by area (public / auth / admin / api / security / a11y / visual)
 *   - a `known-vulnerability` register built from test annotations, so the
 *     security debt is machine-readable and cannot drift from the code
 *   - a non-zero exit when the known-vulnerability count exceeds its baseline
 *
 * Writes to $GITHUB_STEP_SUMMARY too when running under Actions.
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.resolve(process.cwd(), 'test-results/e2e-results.json');
const outputPath = path.resolve(process.cwd(), 'test-results/e2e-summary.md');
const baselinePath = path.resolve(process.cwd(), 'known-vulnerabilities.json');

function readResults() {
  if (!fs.existsSync(resultsPath)) {
    throw new Error(
      `Playwright JSON results not found at ${resultsPath}. Run the suite first (npm test).`,
    );
  }
  return JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
}

function collectSpecs(suites, acc = []) {
  if (!Array.isArray(suites)) return acc;
  for (const suite of suites) {
    if (Array.isArray(suite.specs)) acc.push(...suite.specs);
    if (Array.isArray(suite.suites)) collectSpecs(suite.suites, acc);
  }
  return acc;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function firstError(result) {
  if (!result) return '';
  if (result.error && result.error.message) return result.error.message.split('\n')[0];
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const msg = result.errors[0].message || result.errors[0].value;
    if (msg) return String(msg).split('\n')[0];
  }
  return '';
}

function stripAnsi(input) {
  return String(input).replace(/\x1B\[[0-9;]*m/g, '');
}

const cell = (s) => stripAnsi(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

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

/** Extract the case ID (BOOK-N-01, API-AUTH-P-03, SEC-07) from a test title. */
function caseIdOf(title) {
  const m = /\b([A-Z][A-Z0-9]{1,9}(?:-[A-Z]+)?-[PNESAV]-\d{1,3}|SEC-\d{1,3})\b/.exec(String(title));
  return m ? m[1] : '';
}

const LABEL = {
  passed: 'PASS',
  failed: 'FAIL',
  timedOut: 'FAIL',
  skipped: 'SKIP',
  flaky: 'FLAKY',
  interrupted: 'INFO',
  expected: 'PASS',
  unexpected: 'FAIL',
};

function buildRows(data) {
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
        // `status` is the outcome including expected-failure handling; fall back
        // to the raw result status when absent.
        status: test.status || last.status || 'unknown',
        attempts: results.length,
        duration: formatDuration(results.reduce((n, r) => n + (r.duration || 0), 0)),
        reason: firstError(last),
        vulnerability: vuln ? vuln.description : '',
        tags: (spec.tags || []).join(' '),
      });
    }
  }
  return rows;
}

function buildReport(rows, meta) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const total = rows.length;
  const passed = count('passed') + count('expected');
  const failed = count('failed') + count('unexpected') + count('timedOut');
  const skipped = count('skipped');
  const flaky = count('flaky');
  const vulns = rows.filter((r) => r.vulnerability);

  const L = [];
  L.push('# Utsava E2E — Test Report');
  L.push('');
  if (meta.commit) L.push(`Commit \`${meta.commit}\`${meta.runUrl ? ` · [run](${meta.runUrl})` : ''}`);
  L.push('');
  L.push('| Total | Passed | Failed | Skipped | Flaky |');
  L.push('|---:|---:|---:|---:|---:|');
  L.push(`| ${total} | ${passed} | ${failed} | ${skipped} | ${flaky} |`);
  L.push('');

  // ---- per-area rollup
  L.push('## By area');
  L.push('');
  L.push('| Area | Total | Passed | Failed | Skipped |');
  L.push('|---|---:|---:|---:|---:|');
  for (const area of [...new Set(rows.map((r) => r.area))].sort()) {
    const a = rows.filter((r) => r.area === area);
    const ok = a.filter((r) => r.status === 'passed' || r.status === 'expected').length;
    const bad = a.filter((r) => ['failed', 'unexpected', 'timedOut'].includes(r.status)).length;
    const sk = a.filter((r) => r.status === 'skipped').length;
    L.push(`| ${area} | ${a.length} | ${ok} | ${bad} | ${sk} |`);
  }
  L.push('');

  // ---- known vulnerabilities
  L.push('## Known vulnerability register');
  L.push('');
  if (!vulns.length) {
    L.push('None. Every security case asserts and meets its secure expectation. 🎉');
  } else {
    L.push(
      'Each case asserts the SECURE expectation and is wrapped in `test.fail()`, so Playwright ' +
        'reports it as *expected to fail* while the finding is present.',
    );
    L.push('');
    L.push(
      '**FIXED** means the assertion unexpectedly passed — the vulnerability is gone. Delete the ' +
        '`test.fail()` wrapper and the annotation, and lower the baseline in ' +
        '`known-vulnerabilities.json` in the same PR.',
    );
    L.push('');
    L.push('| State | Case | Finding | File |');
    L.push('|---|---|---|---|');
    for (const r of vulns) {
      /**
       * Deliberately NOT the generic LABEL map, whose PASS/FAIL is inverted for an
       * expected-failure: `expected` means the test failed as intended (so the vulnerability is
       * still present), and `unexpected` means it passed (so the vulnerability is fixed). Using
       * PASS/FAIL here would read as exactly the opposite of the truth.
       */
      const state =
        r.status === 'unexpected' || r.status === 'passed'
          ? '✅ FIXED'
          : r.status === 'skipped'
            ? '— not run'
            : '🔓 present';
      L.push(`| ${state} | ${cell(r.id || r.title)} | ${cell(r.vulnerability)} | ${cell(r.file)} |`);
    }
  }
  L.push('');

  // ---- failures first, then everything
  const failures = rows.filter((r) => ['failed', 'unexpected', 'timedOut', 'flaky'].includes(r.status));
  if (failures.length) {
    L.push('## Failures');
    L.push('');
    L.push('| Case | Test | Project | Attempts | Result Reason |');
    L.push('|---|---|---|---:|---|');
    for (const r of failures) {
      L.push(`| ${cell(r.id)} | ${cell(r.title)} | ${cell(r.project)} | ${r.attempts} | ${cell(r.reason)} |`);
    }
    L.push('');
  }

  const skips = rows.filter((r) => r.status === 'skipped');
  if (skips.length) {
    L.push('## Intentional skips');
    L.push('');
    L.push(
      'The app genuinely lacks these surfaces (no `/register`, no vendor portal, no mobile admin nav, ' +
        'hard-coded revenue chart). See `e2e/README.md` → Intentional skips.',
    );
    L.push('');
    L.push('| Case | Test | Reason |');
    L.push('|---|---|---|');
    for (const r of skips) L.push(`| ${cell(r.id)} | ${cell(r.title)} | ${cell(r.reason)} |`);
    L.push('');
  }

  L.push('## All test cases');
  L.push('');
  L.push('| Status | Case | Test | Area | Project | Duration | Result Reason |');
  L.push('|---|---|---|---|---|---:|---|');
  for (const r of rows) {
    L.push(
      `| ${LABEL[r.status] || 'INFO'} | ${cell(r.id)} | ${cell(r.title)} | ${r.area} | ${cell(r.project)} | ${r.duration} | ${cell(r.reason)} |`,
    );
  }

  L.push('');
  L.push('## Artifacts');
  L.push('');
  L.push('- Playwright HTML report: `playwright-report/index.html`');
  L.push('- Standalone HTML summary: `test-results/e2e-report.html`');
  L.push('- JSON source: `test-results/e2e-results.json`');

  return { markdown: L.join('\n'), vulnCount: vulns.length, failed };
}

try {
  const data = readResults();
  const rows = buildRows(data);
  const { markdown, vulnCount } = buildReport(rows, {
    commit: (process.env.GITHUB_SHA || '').slice(0, 7),
    runUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : '',
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);
  console.log(`Markdown report written to ${outputPath}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }

  /**
   * Security-debt ratchet. `known-vulnerabilities.json` holds `{ "baseline": N }`. The count may
   * fall freely; it may never rise without someone deliberately raising the baseline in a
   * reviewed commit.
   *
   * Only ENFORCED when `E2E_ENFORCE_RATCHET=1`, which the CI report job sets after merging every
   * shard. On a partial run — `--grep SEC-17`, a single shard, a developer running one file — the
   * count is a fraction of the real total, so comparing it to the baseline would either raise a
   * false alarm or falsely claim an improvement. Outside CI it therefore reports and moves on.
   */
  if (fs.existsSync(baselinePath)) {
    const { baseline } = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
    const enforce = process.env.E2E_ENFORCE_RATCHET === '1';

    if (!Number.isFinite(baseline)) {
      console.warn('::warning::known-vulnerabilities.json has no numeric `baseline`; skipping the ratchet.');
    } else if (!enforce) {
      console.log(
        `Known-vulnerability count in this run: ${vulnCount} (baseline ${baseline}). ` +
          'Not enforced — set E2E_ENFORCE_RATCHET=1 on a full run to gate on it.',
      );
    } else if (vulnCount > baseline) {
      console.error(
        `::error::Known-vulnerability count rose from ${baseline} to ${vulnCount}. ` +
          'Fix the finding, or raise the baseline in e2e/known-vulnerabilities.json with a justification.',
      );
      process.exit(1);
    } else if (vulnCount < baseline) {
      console.log(
        `::notice::Known-vulnerability count fell from ${baseline} to ${vulnCount}. ` +
          'Lower the baseline in e2e/known-vulnerabilities.json to lock the improvement in.',
      );
    } else {
      console.log(`Known-vulnerability count is at its baseline of ${baseline}.`);
    }
  }
} catch (error) {
  console.error(`Failed to generate the E2E summary: ${error.message}`);
  process.exit(1);
}
