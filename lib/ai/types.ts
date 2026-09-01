export type ProviderId = 'groq' | 'openai' | 'openrouter' | 'gemini';

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  gemini: 'Gemini'
};

/** One API key/account, loaded from environment variables server-side only. The raw key
 *  never leaves this module - everything else works with `accountId` + a masked display key. */
export interface AccountConfig {
  accountId: string;
  provider: ProviderId;
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Position in the fixed failover order (lower = tried first). Determined by the order
   *  providers/accounts are declared via env vars - there's no live re-priority UI since
   *  that would need somewhere durable to persist the change. */
  priority: number;
}

export type AccountStatus = 'healthy' | 'cooling-down' | 'disabled' | 'unknown';

export interface AccountHealth {
  status: AccountStatus;
  cooldownUntil: number | null;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
  requestCount: number;
  successCount: number;
  failureCount: number;
}

export interface UsageEvent {
  id: string;
  timestamp: number;
  accountId: string;
  provider: ProviderId;
  label: string;
  ok: boolean;
  durationMs: number;
  errorType?: 'rate-limit' | 'auth' | 'network' | 'other';
  errorMessage?: string;
}

/** What the frontend is allowed to see - the key is masked, never sent whole. */
export interface AccountStatusView {
  accountId: string;
  provider: ProviderId;
  providerLabel: string;
  label: string;
  maskedKey: string;
  priority: number;
  disabledByUser: boolean;
  health: AccountHealth;
}

export class ProviderCallError extends Error {
  errorType: 'rate-limit' | 'auth' | 'network' | 'other';
  retryAfterSeconds: number | null;
  constructor(message: string, errorType: 'rate-limit' | 'auth' | 'network' | 'other', retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ProviderCallError';
    this.errorType = errorType;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
