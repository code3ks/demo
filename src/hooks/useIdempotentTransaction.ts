import { useState, useCallback, useRef } from 'react';
import { useTransactionIntentStore, TransactionIntent } from '@/stores/transactionIntentStore';
import { useActivityStore } from '@/stores/activityStore';
interface UseIdempotentTransactionParams {
  chain: string;
  wallet: string;
  action: TransactionIntent['action'];
  metadata?: Record<string, any>;
}
interface UseIdempotentTransactionReturn {
  isSubmitting: boolean;
  intentId: string | null;
  submit: <T>(
    txBuilder: () => Promise<{ txHash: string; result: T }>,
    options?: { onSuccess?: (result: T) => void; onError?: (error: Error) => void },
  ) => Promise<void>;
  reset: () => void;
}
/**
 * Hook to ensure idempotent transaction submission
 * Prevents double submissions and reconciles pending intents with confirmed transactions
 */
export function useIdempotentTransaction(
  params: UseIdempotentTransactionParams
): UseIdempotentTransactionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [intentId, setIntentId] = useState<string | null>(null);
  const submissionLockRef = useRef(false);
  const {
    createIntent,
    getIntent,
    updateIntentStatus,
    setIntentTxHash,
    setIntentHorizonHash,
    findPendingIntent,
  } = useTransactionIntentStore();
  const { addEntry: addActivity, updateStatus: updateActivity } = useActivityStore();
  const submit = useCallback(
    async <T>(
      txBuilder: () => Promise<{ txHash: string; result: T }>,
      options?: { onSuccess?: (result: T) => void; onError?: (error: Error) => void },
    ) => {
      // Prevent concurrent submissions from the same component instance
      if (submissionLockRef.current) {
        console.warn(
          '[IdempotentTx] Submission already in progress, ignoring duplicate call',
        );
        return;
      }
      // Check for existing pending intent with same parameters
      const existingIntent = findPendingIntent(params);
      if (existingIntent) {
        console.warn(
          '[IdempotentTx] Found existing pending intent, blocking duplicate:',
          existingIntent.id,
        );
        return;
      }
      submissionLockRef.current = true;
      setIsSubmitting(true);
      // Create new intent
      const newIntentId = createIntent(params);
      setIntentId(newIntentId);
      try {
        // Update intent to signing
        updateIntentStatus(newIntentId, 'signing');
        // Build and sign transaction (this may throw if user rejects)
        const { txHash, result } = await txBuilder();
        // Update intent with txHash
        setIntentTxHash(newIntentId, txHash);
        // Add to activity store
        addActivity({
          id: txHash,
          chain: params.chain,
          wallet: params.wallet,
          kind: getActivityKind(params.action),
          direction: getActivityDirection(params.action),
          status: 'pending',
          timestamp: Date.now(),
          metadata: { intentId: newIntentId },
        });
        // Update intent to submitting
        updateIntentStatus(newIntentId, 'submitting');
        // Transaction is now submitted, mark as confirmed
        updateIntentStatus(newIntentId, 'confirmed');
        updateActivity(txHash, 'confirmed');
        if (options?.onSuccess) {
          options.onSuccess(result);
        }
      } catch (error) {
        const err = error as Error;
        console.error('[IdempotentTx] Transaction failed:', err);
        // Update intent as failed
        updateIntentStatus(newIntentId, 'failed', err.message);
        // Get the intent to check if we have a txHash
        const intent = getIntent(newIntentId);
        if (intent?.txHash) {
          // Transaction was built but submission failed
          updateActivity(intent.txHash, 'failed');
        }
        if (options?.onError) {
          options.onError(err);
        } else {
          throw error;
        }
      } finally {
        submissionLockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [
      params,
      createIntent,
      updateIntentStatus,
      setIntentTxHash,
      getIntent,
      findPendingIntent,
      addActivity,
      updateActivity,
    ],
  );
  const reset = useCallback(() => {
    setIntentId(null);
    setIsSubmitting(false);
    submissionLockRef.current = false;
  }, []);
  return {
    isSubmitting,
    intentId,
    submit,
    reset,
  };
}
// Helper to map action to ActivityKind
function getActivityKind(action: TransactionIntent['action']) {
  switch (action) {
    case 'send':
      return 'stealth-send' as const;
    case 'batch-send':
      return 'stealth-send' as const;
    case 'batch-withdraw':
    case 'vault-claim':
      return 'withdrawal' as const;
    case 'vault-deposit':
      return 'stealth-send' as const;
    case 'name-register':
    case 'name-transfer':
    case 'name-renew':
    case 'name-set-metadata':
      return 'name-registration' as const;
    default:
      return 'stealth-send' as const;
  }
}
// Helper to map action to ActivityDirection
function getActivityDirection(action: TransactionIntent['action']) {
  switch (action) {
    case 'batch-withdraw':
    case 'vault-claim':
      return 'in' as const;
    default:
      return 'out' as const;
  }
}
