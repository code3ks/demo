# Dependency security audit

Tracking issue: [#223 — Remediate critical demo runtime dependency findings](https://github.com/wraith-protocol/demo/issues/223).

This document records how the production dependency audit for the demo is kept
healthy and lists every finding we knowingly accept, who owns it, and when it
must be re-checked. CI enforces the baseline described here.

## Policy

- **No critical findings are ever accepted.** `pnpm audit:gate` (run in CI)
  fails the build as soon as a critical production finding appears.
- Direct dependencies are kept on patched releases.
- When a transitive finding has no patched release (or upgrading would break a
  supported chain integration), it is recorded in [Accepted findings](#accepted-findings)
  with an owner and an expiry date instead of being silently ignored.
- The accepted baseline is small and is expected to shrink, never grow.

## Result

`pnpm audit --prod` before and after this remediation:

| Severity  | Before | After |
| --------- | -----: | ----: |
| Critical  |      1 |     0 |
| High      |     53 |     1 |
| Moderate  |     86 |     8 |
| Low       |      7 |     2 |
| **Total** |    147 |    11 |

The single remaining high finding (`braces`) has no patched release upstream and
is documented below. The critical (`shell-quote`) was removed by an override.

## How to run the audit

```bash
pnpm audit:prod   # human-readable production audit
pnpm audit:gate   # what CI enforces (exit non-zero on regression)
```

`pnpm audit:gate` runs `pnpm audit --prod --json`, compares the severity counts
against the baseline in `scripts/audit-gate.mjs`, and prints a summary.

## Remediation applied

### Direct dependencies upgraded

| Package                      | From              | To                | Why                                                    |
| ---------------------------- | ----------------- | ----------------- | ------------------------------------------------------ |
| `react-router-dom`           | `^7.6.0`          | `^7.18.4`         | Resolves the `react-router` advisories.                |
| `@stellar/stellar-sdk`       | `^13.1.0`         | `^13.3.0`         | Latest patched 13.x; avoids a breaking major API jump. |
| `@ckb-ccc/ccc`               | `^1.1.25`         | `^1.3.6`          | Patched 1.x line (CKB).                                |
| `wagmi`                      | `^2.14.0`         | `^2.19.5`         | Latest 2.x (RainbowKit 2.x is not compatible with v3). |
| `@rainbow-me/rainbowkit`     | `^2.2.0`          | `^2.2.11`         | Matches the wagmi 2.x line.                            |
| `viem`                       | `^2.23.0`         | `^2.57.7`         | Patched 2.x.                                           |
| `@solana/web3.js`            | `^1.98.4`         | `^1.99.0`         | Latest patched 1.x.                                    |
| `@solana/wallet-adapter-*`   | `0.9.27`/`0.9.29` | `0.9.28`/`0.9.30` | Latest patched adapters.                               |
| `@walletconnect/core`        | `^2.23.10`        | `^2.26.0`         | Latest patched 2.x.                                    |
| `@walletconnect/sign-client` | `^2.23.10`        | `^2.26.0`         | Latest patched 2.x.                                    |
| `@tanstack/react-query`      | `^5.64.0`         | `^5.104.3`        | Latest patched 5.x.                                    |

### Transitive dependencies forced via `pnpm.overrides`

Some findings live deep in the tree and are only reachable by forcing a patched
version with `pnpm.overrides` (see `package.json`). Each override stays within a
range the consumer already declares (or a compatible major), so runtime
behaviour is preserved:

| Package            | Forced to | Reported advisory                                    |
| ------------------ | --------- | ---------------------------------------------------- |
| `axios`            | `1.20.0`  | Multiple GHSA advisories on the 1.x line.            |
| `form-data`        | `4.0.6`   | GHSA-hmw2-7cc7-3qxx.                                 |
| `hono`             | `4.13.13` | Multiple GHSA advisories on the 4.x line.            |
| `socket.io-parser` | `4.2.7`   | GHSA-2m8v-j782-fhvr.                                 |
| `browserslist`     | `4.29.3`  | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g.            |
| `image-size`       | `2.0.4`   | GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr.            |
| `shell-quote`      | `1.12.0`  | GHSA-pqg4-j6r4-53mv (critical), GHSA-395f-4hp3-45gv. |
| `toml`             | `4.2.0`   | GHSA-82x6-q7mm-w9cf, GHSA-v5mp-jgw5-2x6j.            |
| `ws`               | `8.22.0`  | GHSA-96hv-2xvq-fx4p, GHSA-58qx-3vcg-4xpx.            |

The `toml` override is safe because `@stellar/stellar-sdk` only uses `toml`
inside `StellarToml.Resolver`, which the demo never calls (`@stellar/stellar-sdk`
is used for `rpc`, `xdr`, `Address` and transaction building only).

## Accepted findings

Everything below is transitive, has no patched release inside the range the
consumer declares, and would require a breaking major bump of a package we do
not control. All are accepted with an owner and an expiry; re-check on or before
the expiry.

| Package                | Severity | Advisory                                                      | Dependency path                                                                                                   | Owner                          | Expiry     |
| ---------------------- | -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| `braces`               | high     | GHSA-vfj7-8cjw-p6xm                                           | `@solana/wallet-adapter-react` → `@solana-mobile/wallet-adapter-mobile` → `react-native` → `metro` → `micromatch` | `@wraith-protocol/maintainers` | 2027-01-15 |
| `uuid`                 | moderate | GHSA-w5hq-g745-h8pq                                           | `@solana/web3.js` → `jayson`/`rpc-websockets`; `wagmi` → `@metamask/utils`                                        | `@wraith-protocol/maintainers` | 2027-01-15 |
| `valibot`              | moderate | GHSA-5qjj-4xww-7phc                                           | `@ckb-ccc/connector-react` → `@ckb-ccc/connector` → `@ckb-ccc/ccc` → `@ckb-ccc/xverse`                            | `@wraith-protocol/maintainers` | 2027-01-15 |
| `decode-uri-component` | moderate | GHSA-vcc3-ghjq-m6fr                                           | `wagmi` → `@walletconnect/ethereum-provider` → `@reown/appkit` → `query-string`                                   | `@wraith-protocol/maintainers` | 2027-01-15 |
| `stream-json`          | moderate | GHSA-528h-pc64-c93x, GHSA-hqr4-qq8f-hg3x, GHSA-mjw6-4jj6-33hc | `@solana/web3.js` → `jayson` → `stream-json`                                                                      | `@wraith-protocol/maintainers` | 2027-01-15 |
| `elliptic`             | low      | GHSA-848j-6mx2-7j84                                           | `@ckb-ccc/ccc` → `@ckb-ccc/eip6963` → `@joyid/ckb` → `@nervosnetwork/ckb-sdk-utils`                               | `@wraith-protocol/maintainers` | 2027-01-15 |
| `@babel/core`          | low      | GHSA-4x5r-pxfx-6jf8                                           | `@solana/wallet-adapter-react` → `react-native` → `@react-native/codegen`                                         | `@wraith-protocol/maintainers` | 2027-01-15 |

Notes:

- `braces` is reached only through the React Native/Metro tooling pulled in by
  the Solana Mobile wallet adapter; it is build-time code and is not part of the
  browser bundle shipped by `vite build`.
- `braces` is currently unfixable: the latest published release (`3.0.3`) is the
  affected version. This entry should be removed as soon as a patched release is
  published.

## CI gate

`.github/workflows/ci.yml` runs `pnpm audit:gate` on every push and pull request
to `main`/`develop`. The gate lives in `scripts/audit-gate.mjs` and enforces the
baseline:

- **critical ≤ 0** — a new critical finding always fails CI.
- **high ≤ 1** — the single accepted `braces` finding above.

Raising either baseline requires a matching entry (owner + expiry) in the table
above.

## Review cadence

Re-run `pnpm audit:prod` on or before each expiry date, upgrade where a patched
release now exists, and remove the corresponding override/exception.
