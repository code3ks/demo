/**
 * Typed Worker Message Protocol
 *
 * This module defines versioned TypeScript message unions for communication
 * between foreground pages and service workers, with runtime validation
 * to prevent silent breakage.
 *
 * Protocol Version: 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// Protocol Version
// ═══════════════════════════════════════════════════════════════════════════

export const PROTOCOL_VERSION = '1.0.0' as const;

// ═══════════════════════════════════════════════════════════════════════════
// Service Worker Messages (Page ↔ Service Worker)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Message to register a viewing key with the service worker
 */
export interface RegisterViewingKeyMessage {
  type: 'REGISTER_VIEWING_KEY';
  version: typeof PROTOCOL_VERSION;
  publicKey: string;
  encryptedViewingKey: ArrayBuffer;
  encryptedSpendingPubKey: ArrayBuffer;
  encryptedSpendingScalar: ArrayBuffer;
}

/**
 * Message to unregister a viewing key from the service worker
 */
export interface UnregisterViewingKeyMessage {
  type: 'UNREGISTER_VIEWING_KEY';
  version: typeof PROTOCOL_VERSION;
  publicKey: string;
}

/**
 * Message to trigger a blockchain scan
 */
export interface TriggerScanMessage {
  type: 'TRIGGER_SCAN';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Message to register a push subscription
 */
export interface RegisterPushSubscriptionMessage {
  type: 'REGISTER_PUSH_SUBSCRIPTION';
  version: typeof PROTOCOL_VERSION;
  subscription: PushSubscription;
  metaAddressHash: string;
  relayUrl?: string;
}

/**
 * Message to unregister a push subscription
 */
export interface UnregisterPushSubscriptionMessage {
  type: 'UNREGISTER_PUSH_SUBSCRIPTION';
  version: typeof PROTOCOL_VERSION;
  subscription: PushSubscription;
  metaAddressHash?: string;
}

/**
 * Message to skip waiting during service worker update
 */
export interface SkipWaitingMessage {
  type: 'SKIP_WAITING';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Response: Viewing key registered successfully
 */
export interface ViewingKeyRegisteredMessage {
  type: 'VIEWING_KEY_REGISTERED';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Response: Viewing key unregistered successfully
 */
export interface ViewingKeyUnregisteredMessage {
  type: 'VIEWING_KEY_UNREGISTERED';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Response: Viewing key error
 */
export interface ViewingKeyErrorMessage {
  type: 'VIEWING_KEY_ERROR';
  version: typeof PROTOCOL_VERSION;
  error: string;
}

/**
 * Response: Push subscription registered successfully
 */
export interface PushSubscriptionRegisteredMessage {
  type: 'PUSH_SUBSCRIPTION_REGISTERED';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Response: Push subscription unregistered successfully
 */
export interface PushSubscriptionUnregisteredMessage {
  type: 'PUSH_SUBSCRIPTION_UNREGISTERED';
  version: typeof PROTOCOL_VERSION;
}

/**
 * Response: Push subscription error
 */
export interface PushSubscriptionErrorMessage {
  type: 'PUSH_SUBSCRIPTION_ERROR';
  version: typeof PROTOCOL_VERSION;
  error: string;
}

/**
 * Union of all messages sent FROM page TO service worker
 */
export type ServiceWorkerInboundMessage =
  | RegisterViewingKeyMessage
  | UnregisterViewingKeyMessage
  | TriggerScanMessage
  | RegisterPushSubscriptionMessage
  | UnregisterPushSubscriptionMessage
  | SkipWaitingMessage;

/**
 * Union of all messages sent FROM service worker TO page
 */
export type ServiceWorkerOutboundMessage =
  | ViewingKeyRegisteredMessage
  | ViewingKeyUnregisteredMessage
  | ViewingKeyErrorMessage
  | PushSubscriptionRegisteredMessage
  | PushSubscriptionUnregisteredMessage
  | PushSubscriptionErrorMessage;

// ═══════════════════════════════════════════════════════════════════════════
// BroadcastChannel Messages (Cross-tab Wallet Sync)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wallet connected notification
 */
export interface WalletConnectedMessage {
  type: 'CONNECTED';
  version: typeof PROTOCOL_VERSION;
  address: string;
  origin: string;
}

/**
 * Wallet disconnected notification
 */
export interface WalletDisconnectedMessage {
  type: 'DISCONNECTED';
  version: typeof PROTOCOL_VERSION;
  origin: string;
}

/**
 * Network changed notification
 */
export interface NetworkChangedMessage {
  type: 'NETWORK_CHANGED';
  version: typeof PROTOCOL_VERSION;
  passphrase: string;
  origin: string;
}

/**
 * Wraith notification received (via BroadcastChannel from SW)
 */
export interface WraithNotificationMessage {
  type: 'WRAITH_NOTIFICATION';
  version: typeof PROTOCOL_VERSION;
  channel: string;
  payload: {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    amount?: string;
    asset?: string;
    sender?: string;
    data?: Record<string, unknown>;
  };
}

/**
 * Navigate to stealth address match
 */
export interface NavigateToMatchMessage {
  type: 'NAVIGATE_TO_MATCH';
  version: typeof PROTOCOL_VERSION;
  stealthAddress: string;
}

/**
 * Union of all BroadcastChannel messages
 */
export type BroadcastChannelMessage =
  | WalletConnectedMessage
  | WalletDisconnectedMessage
  | NetworkChangedMessage
  | WraithNotificationMessage
  | NavigateToMatchMessage;

// ═══════════════════════════════════════════════════════════════════════════
// Web Worker Messages (stellar-scanner.worker.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scan strategy configuration
 */
export interface ScanStrategy {
  batchSize?: number;
  maxBatches?: number;
  [key: string]: unknown;
}

/**
 * Request to scan blockchain announcements
 */
export interface ScanRequestMessage {
  type: 'SCAN_REQUEST';
  version: typeof PROTOCOL_VERSION;
  rpcUrl: string;
  announcerContract: string;
  viewingKey: Uint8Array;
  spendingPubKey: Uint8Array;
  spendingScalar: bigint;
  strategy?: ScanStrategy;
}

/**
 * Scan completed successfully
 */
export interface ScanSuccessMessage {
  type: 'SUCCESS';
  version: typeof PROTOCOL_VERSION;
  results: unknown[]; // ScanResult[] - kept generic to avoid coupling
}

/**
 * Scan failed with error
 */
export interface ScanErrorMessage {
  type: 'ERROR';
  version: typeof PROTOCOL_VERSION;
  error: string;
}

/**
 * Union of all web worker messages
 */
export type WebWorkerMessage = ScanRequestMessage | ScanSuccessMessage | ScanErrorMessage;

// ═══════════════════════════════════════════════════════════════════════════
// Runtime Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Type guard: Check if message has required base properties
 */
function hasBaseProperties(msg: unknown): msg is { type: string; version?: string } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string'
  );
}

/**
 * Validate protocol version compatibility
 */
function isVersionCompatible(version: string | undefined): boolean {
  if (!version) {
    // Allow messages without version for backward compatibility
    console.warn(
      '[Protocol] Received message without version, allowing for backward compatibility',
    );
    return true;
  }

  // Extract major version
  const [receivedMajor] = version.split('.');
  const [currentMajor] = PROTOCOL_VERSION.split('.');

  // Major version must match
  return receivedMajor === currentMajor;
}

/**
 * Validate ServiceWorker inbound message
 */
export function validateServiceWorkerInboundMessage(
  msg: unknown,
): ValidationResult & { message?: ServiceWorkerInboundMessage } {
  if (!hasBaseProperties(msg)) {
    return { valid: false, error: 'Invalid message format: missing type or version' };
  }

  if (!isVersionCompatible(msg.version)) {
    return {
      valid: false,
      error: `Incompatible protocol version: received ${msg.version}, expected ${PROTOCOL_VERSION}`,
    };
  }

  const validTypes = [
    'REGISTER_VIEWING_KEY',
    'UNREGISTER_VIEWING_KEY',
    'TRIGGER_SCAN',
    'REGISTER_PUSH_SUBSCRIPTION',
    'UNREGISTER_PUSH_SUBSCRIPTION',
    'SKIP_WAITING',
  ];

  if (!validTypes.includes(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }

  // Type-specific validation
  switch (msg.type) {
    case 'REGISTER_VIEWING_KEY': {
      const required = [
        'publicKey',
        'encryptedViewingKey',
        'encryptedSpendingPubKey',
        'encryptedSpendingScalar',
      ];
      for (const field of required) {
        if (!(field in msg)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
      break;
    }
    case 'UNREGISTER_VIEWING_KEY': {
      if (!('publicKey' in msg) || typeof (msg as { publicKey: unknown }).publicKey !== 'string') {
        return { valid: false, error: 'Missing or invalid publicKey' };
      }
      break;
    }
    case 'REGISTER_PUSH_SUBSCRIPTION':
    case 'UNREGISTER_PUSH_SUBSCRIPTION': {
      if (!('subscription' in msg)) {
        return { valid: false, error: 'Missing required field: subscription' };
      }
      break;
    }
    // TRIGGER_SCAN and SKIP_WAITING have no additional requirements
  }

  return { valid: true, message: msg as ServiceWorkerInboundMessage };
}

/**
 * Validate ServiceWorker outbound message
 */
export function validateServiceWorkerOutboundMessage(
  msg: unknown,
): ValidationResult & { message?: ServiceWorkerOutboundMessage } {
  if (!hasBaseProperties(msg)) {
    return { valid: false, error: 'Invalid message format: missing type or version' };
  }

  if (!isVersionCompatible(msg.version)) {
    return {
      valid: false,
      error: `Incompatible protocol version: received ${msg.version}, expected ${PROTOCOL_VERSION}`,
    };
  }

  const validTypes = [
    'VIEWING_KEY_REGISTERED',
    'VIEWING_KEY_UNREGISTERED',
    'VIEWING_KEY_ERROR',
    'PUSH_SUBSCRIPTION_REGISTERED',
    'PUSH_SUBSCRIPTION_UNREGISTERED',
    'PUSH_SUBSCRIPTION_ERROR',
  ];

  if (!validTypes.includes(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }

  // Error messages must have error field
  if (msg.type.includes('ERROR')) {
    if (!('error' in msg) || typeof (msg as { error: unknown }).error !== 'string') {
      return { valid: false, error: 'Error messages must include error field' };
    }
  }

  return { valid: true, message: msg as ServiceWorkerOutboundMessage };
}

/**
 * Validate BroadcastChannel message
 */
export function validateBroadcastChannelMessage(
  msg: unknown,
): ValidationResult & { message?: BroadcastChannelMessage } {
  if (!hasBaseProperties(msg)) {
    return { valid: false, error: 'Invalid message format: missing type or version' };
  }

  if (!isVersionCompatible(msg.version)) {
    return {
      valid: false,
      error: `Incompatible protocol version: received ${msg.version}, expected ${PROTOCOL_VERSION}`,
    };
  }

  const validTypes = [
    'CONNECTED',
    'DISCONNECTED',
    'NETWORK_CHANGED',
    'WRAITH_NOTIFICATION',
    'NAVIGATE_TO_MATCH',
  ];

  if (!validTypes.includes(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }

  // Type-specific validation
  switch (msg.type) {
    case 'CONNECTED': {
      if (!('address' in msg) || !('origin' in msg)) {
        return { valid: false, error: 'CONNECTED requires address and origin' };
      }
      break;
    }
    case 'DISCONNECTED': {
      if (!('origin' in msg)) {
        return { valid: false, error: 'DISCONNECTED requires origin' };
      }
      break;
    }
    case 'NETWORK_CHANGED': {
      if (!('passphrase' in msg) || !('origin' in msg)) {
        return { valid: false, error: 'NETWORK_CHANGED requires passphrase and origin' };
      }
      break;
    }
    case 'WRAITH_NOTIFICATION': {
      if (!('channel' in msg) || !('payload' in msg)) {
        return { valid: false, error: 'WRAITH_NOTIFICATION requires channel and payload' };
      }
      break;
    }
    case 'NAVIGATE_TO_MATCH': {
      if (!('stealthAddress' in msg)) {
        return { valid: false, error: 'NAVIGATE_TO_MATCH requires stealthAddress' };
      }
      break;
    }
  }

  return { valid: true, message: msg as BroadcastChannelMessage };
}

/**
 * Validate Web Worker message
 */
export function validateWebWorkerMessage(
  msg: unknown,
): ValidationResult & { message?: WebWorkerMessage } {
  if (!hasBaseProperties(msg)) {
    return { valid: false, error: 'Invalid message format: missing type or version' };
  }

  if (!isVersionCompatible(msg.version)) {
    return {
      valid: false,
      error: `Incompatible protocol version: received ${msg.version}, expected ${PROTOCOL_VERSION}`,
    };
  }

  const validTypes = ['SCAN_REQUEST', 'SUCCESS', 'ERROR'];

  if (!validTypes.includes(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }

  // Type-specific validation
  switch (msg.type) {
    case 'SCAN_REQUEST': {
      const required = [
        'rpcUrl',
        'announcerContract',
        'viewingKey',
        'spendingPubKey',
        'spendingScalar',
      ];
      for (const field of required) {
        if (!(field in msg)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
      break;
    }
    case 'SUCCESS': {
      if (!('results' in msg) || !Array.isArray((msg as { results: unknown }).results)) {
        return { valid: false, error: 'SUCCESS requires results array' };
      }
      break;
    }
    case 'ERROR': {
      if (!('error' in msg) || typeof (msg as { error: unknown }).error !== 'string') {
        return { valid: false, error: 'ERROR requires error string' };
      }
      break;
    }
  }

  return { valid: true, message: msg as WebWorkerMessage };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a versioned message with the current protocol version
 */
export function createMessage<T extends { type: string }>(
  message: Omit<T, 'version'>,
): T & { version: typeof PROTOCOL_VERSION } {
  return {
    ...message,
    version: PROTOCOL_VERSION,
  } as T & { version: typeof PROTOCOL_VERSION };
}

/**
 * Safe message sender that automatically adds version
 */
export function postVersionedMessage<T extends { type: string; version?: string }>(
  target: ServiceWorker | Worker | BroadcastChannel | null | undefined,
  message: Omit<T, 'version'>,
): void {
  if (!target) {
    console.error('[Protocol] Cannot send message: target is null or undefined');
    return;
  }

  const versionedMessage = {
    ...message,
    version: PROTOCOL_VERSION,
  } as T;
  target.postMessage(versionedMessage);
}
