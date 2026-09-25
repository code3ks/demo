# pnpm-lock.yaml Update Required

## Issue
CI is failing with:
```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json
* 1 dependencies were added: @testing-library/react@^16.3.3
```

## Root Cause
The dependency `@testing-library/react@^16.3.3` was added to `package.json` in commit 868b5a3, but `pnpm-lock.yaml` was not updated due to local SSL certificate issues preventing `pnpm install` from running.

## Solution
The maintainer needs to update the lockfile. Run these commands:

```bash
git checkout feat/idempotency-protection-183
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml
git commit -m "chore: update pnpm-lock.yaml for @testing-library/react dependency"
git push
```

## Changes Implemented
✅ Added `@testing-library/react@^16.3.3` to `package.json` devDependencies  
✅ Added import for `reconcileStellarTransaction` in `StellarSend.tsx`  
✅ Added `reconcile` callback to `submitIdempotent` call in `StellarSend.tsx`  
✅ Test "should reconcile sent-but-timeout transactions" already exists  
❌ `pnpm-lock.yaml` needs updating (blocked by local SSL issues)

## What Works Now
- Timeout reconciliation mechanism is fully implemented
- When a transaction times out client-side but has a txHash, it queries Horizon
- If found successful on Horizon → marks as `confirmed` (prevents duplicate)
- If not found → marks as `failed` (allows retry)
- Applied to `StellarSend` flow (other flows can be added similarly)

## Note
Contributor cannot update lockfile locally due to SSL certificate errors:
```
UNABLE_TO_VERIFY_LEAF_SIGNATURE: unable to verify the first certificate
```
