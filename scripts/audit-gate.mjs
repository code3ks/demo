#!/usr/bin/env node
// CI gate for production dependency audit findings.
//
// Runs `pnpm audit --prod`, compares the severity counts against the accepted
// baseline below and exits non-zero when the report regresses past it. The
// baseline mirrors docs/SECURITY_AUDIT.md, which documents every accepted
// transitive finding together with its owner and expiry date.
//
// Usage:
//   pnpm audit:gate
//   AUDIT_MAX_HIGH=2 pnpm audit:gate   # temporary override for a known bump
import { spawnSync } from 'node:child_process';

// --- Accepted baseline (keep in sync with docs/SECURITY_AUDIT.md) -----------
// A new critical finding always fails CI: critical vulnerabilities are never
// accepted, only upgraded or removed.
const MAX_CRITICAL = 0;
// High findings that currently have no patched release (see the doc).
const MAX_HIGH = 1;
// ---------------------------------------------------------------------------

function runProductionAudit() {
  const result = spawnSync('pnpm audit --prod --json', {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  const stdout = result.stdout ?? '';
  if (!stdout.trim()) {
    console.error('Could not read `pnpm audit --prod --json` output.');
    if (result.stderr) console.error(result.stderr.trim());
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  return JSON.parse(stdout);
}

const baseline = {
  critical: MAX_CRITICAL,
  high: MAX_HIGH,
};

const report = runProductionAudit();
const counts = report.metadata?.vulnerabilities ?? {};
const summary = {
  critical: counts.critical ?? 0,
  high: counts.high ?? 0,
  moderate: counts.moderate ?? 0,
  low: counts.low ?? 0,
  info: counts.info ?? 0,
};

console.log(
  `Production audit: ${summary.critical} critical, ${summary.high} high, ` +
    `${summary.moderate} moderate, ${summary.low} low, ${summary.info} info`,
);

const regressions = Object.entries(baseline)
  .filter(([severity, allowed]) => summary[severity] > allowed)
  .map(
    ([severity, allowed]) =>
      `${severity} findings ${summary[severity]} exceed the allowed ${allowed}`,
  );

if (regressions.length > 0) {
  console.error('\nDependency audit gate failed:');
  for (const regression of regressions) console.error(`  - ${regression}`);
  console.error(
    '\nUpgrade the offending dependency. If no patched release exists yet, ' +
      'record the exception (owner + expiry) in docs/SECURITY_AUDIT.md and ' +
      'update the baseline here and in the doc together.',
  );
  process.exit(1);
}

console.log('Dependency audit gate passed.');
