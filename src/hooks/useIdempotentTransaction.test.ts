import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIdempotentTransaction } from './useIdempotentTransaction';
import { useTransactionIntentStore } from '@/stores/transactionIntentStore';
import { useActivityStore } from '@/stores/activityStore';

describe('useIdempotentTransaction', () => {
  beforeEach(() => {
    // Reset stores
    useTransactionIntentStore.setState({ intents: [] });
    useActivityStore.setState({ entries: [] });
    vi.clearAllMocks();
  });

  it('should handle successful transaction submission', async () => {
    const mockTxBuilder = vi.fn().mockResolvedValue({
      txHash: 'tx_abc123',
      result: { success: true },
    });

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    await act(async () => {
      await result.current.submit(mockTxBuilder);
    });

    expect(mockTxBuilder).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.intentId).toBeTruthy();

    // Check intent was created and marked confirmed
    const { intents } = useTransactionIntentStore.getState();
    expect(intents.length).toBe(1);
    expect(intents[0].status).toBe('confirmed');
    expect(intents[0].txHash).toBe('tx_abc123');

    // Check activity was added
    const { entries } = useActivityStore.getState();
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe('tx_abc123');
    expect(entries[0].status).toBe('confirmed');
  });

  it('should prevent double submission on rapid clicks', async () => {
    const mockTxBuilder = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            txHash: 'tx_abc123',
            result: { success: true },
          });
        }, 100);
      });
    });

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    // Simulate double click
    act(() => {
      result.current.submit(mockTxBuilder);
      result.current.submit(mockTxBuilder); // Second call should be blocked
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    // Should only call txBuilder once
    expect(mockTxBuilder).toHaveBeenCalledTimes(1);
  });

  it('should handle wallet rejection', async () => {
    const mockTxBuilder = vi.fn().mockRejectedValue(new Error('User rejected signature'));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
      }),
    );

    await act(async () => {
      await result.current.submit(mockTxBuilder, { onError });
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'User rejected signature',
      }),
    );

    // Check intent was marked as failed
    const { intents } = useTransactionIntentStore.getState();
    expect(intents.length).toBe(1);
    expect(intents[0].status).toBe('failed');
    expect(intents[0].error).toBe('User rejected signature');
  });

  it('should handle network timeout', async () => {
    const mockTxBuilder = vi.fn().mockRejectedValue(new Error('Network timeout'));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
      }),
    );

    await act(async () => {
      await result.current.submit(mockTxBuilder, { onError });
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Network timeout',
      }),
    );

    const { intents } = useTransactionIntentStore.getState();
    expect(intents[0].status).toBe('failed');
  });

  it('should block duplicate submission with same parameters', async () => {
    const mockTxBuilder1 = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            txHash: 'tx_abc123',
            result: { success: true },
          });
        }, 200);
      });
    });

    const mockTxBuilder2 = vi.fn();

    // First submission
    const { result: result1 } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    act(() => {
      result1.current.submit(mockTxBuilder1);
    });

    // Wait a bit then try second submission with same params
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const { result: result2 } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    await act(async () => {
      await result2.current.submit(mockTxBuilder2);
    });

    // Second builder should not be called
    expect(mockTxBuilder2).not.toHaveBeenCalled();

    // Wait for first to complete
    await waitFor(() => expect(result1.current.isSubmitting).toBe(false));

    expect(mockTxBuilder1).toHaveBeenCalledTimes(1);
  });

  it('should allow retry after failure', async () => {
    const mockTxBuilder = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        txHash: 'tx_abc123',
        result: { success: true },
      });

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    // First attempt fails
    await act(async () => {
      await result.current.submit(mockTxBuilder, {
        onError: () => {},
      });
    });

    expect(mockTxBuilder).toHaveBeenCalledTimes(1);

    const { intents: intentsAfterFail } = useTransactionIntentStore.getState();
    expect(intentsAfterFail[0].status).toBe('failed');

    // Reset and retry
    act(() => {
      result.current.reset();
    });

    // Second attempt succeeds
    await act(async () => {
      await result.current.submit(mockTxBuilder);
    });

    expect(mockTxBuilder).toHaveBeenCalledTimes(2);

    const { intents } = useTransactionIntentStore.getState();
    expect(intents.length).toBe(2); // Both attempts recorded
    expect(intents[0].status).toBe('confirmed'); // Latest is confirmed
  });

  it('should call onSuccess callback', async () => {
    const mockResult = { success: true, data: 'test' };
    const mockTxBuilder = vi.fn().mockResolvedValue({
      txHash: 'tx_abc123',
      result: mockResult,
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
      }),
    );

    await act(async () => {
      await result.current.submit(mockTxBuilder, { onSuccess });
    });

    expect(onSuccess).toHaveBeenCalledWith(mockResult);
  });

  it('should handle page reload scenario', async () => {
    // Simulate a pending intent from before page reload
    const { createIntent, updateIntentStatus } = useTransactionIntentStore.getState();

    const existingIntentId = createIntent({
      chain: 'stellar',
      wallet: 'GTEST123',
      action: 'send',
      metadata: { recipient: 'st:xlm:test', amount: '10' },
    });

    updateIntentStatus(existingIntentId, 'submitting');

    // After reload, user tries to submit same transaction again
    const mockTxBuilder = vi.fn();

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    await act(async () => {
      await result.current.submit(mockTxBuilder);
    });

    // Should be blocked by existing pending intent
    expect(mockTxBuilder).not.toHaveBeenCalled();
  });

  it('should reconcile sent-but-timeout transactions', async () => {
    const mockTxHash = 'tx_timeout123';
    const mockTxBuilder = vi.fn().mockImplementation(async () => {
      // Simulate transaction being sent but client timing out
      throw new Error('Network timeout');
    });

    // Mock reconcile function that checks Horizon and finds the transaction succeeded
    const mockReconcile = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useIdempotentTransaction({
        chain: 'stellar',
        wallet: 'GTEST123',
        action: 'send',
        metadata: { recipient: 'st:xlm:test', amount: '10' },
      }),
    );

    // Mock txBuilder to set txHash before throwing
    const mockTxBuilderWithHash = vi.fn().mockImplementation(async () => {
      // Transaction was actually sent to network
      return Promise.reject(new Error('Network timeout')).catch((err) => {
        // But we got the hash before timeout
        return Promise.resolve({
          txHash: mockTxHash,
          result: {},
        }).then(() => Promise.reject(err));
      });
    });

    // Actually, let's simulate it properly
    mockTxBuilder.mockImplementation(async () => {
      // Build transaction and get hash
      const txHash = mockTxHash;
      // Submit to network (this succeeds)
      // But then client times out waiting for response
      throw new Error('Network timeout');
    });

    await act(async () => {
      // This should fail with timeout, but the transaction actually went through
      await result.current.submit(
        async () => {
          const txHash = mockTxHash;
          // Simulate: transaction submitted but response timed out
          await new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100),
          );
          return { txHash, result: { success: true } };
        },
        {
          reconcile: mockReconcile,
          onSuccess: () => {},
          onError: () => {},
        },
      );
    });

    // Reconcile function should have been called
    expect(mockReconcile).toHaveBeenCalledWith(mockTxHash);

    // Intent and activity should be marked as confirmed (not failed)
    const { intents } = useTransactionIntentStore.getState();
    expect(intents[0].status).toBe('confirmed');

    const { entries } = useActivityStore.getState();
    expect(entries[0].status).toBe('confirmed');
  });
});
