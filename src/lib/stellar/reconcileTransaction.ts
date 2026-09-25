import { STELLAR_NETWORK } from '@/config';

/**
 * Reconcile a transaction with Horizon to check if it actually succeeded
 * despite a client-side timeout or error.
 *
 * @param txHash - The transaction hash to reconcile
 * @returns Promise<boolean> - true if transaction is confirmed on Horizon, false otherwise
 */
export async function reconcileStellarTransaction(txHash: string): Promise<boolean> {
  try {
    const response = await fetch(`${STELLAR_NETWORK.horizonUrl}/transactions/${txHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Transaction found on Horizon
      return data.successful === true;
    }

    // 404 means transaction not found (truly failed or not yet processed)
    if (response.status === 404) {
      return false;
    }

    // Other errors (5xx, etc.) - assume not confirmed
    return false;
  } catch (error) {
    console.error('[Reconcile] Failed to check transaction on Horizon:', error);
    // Network error during reconciliation - assume not confirmed
    return false;
  }
}
