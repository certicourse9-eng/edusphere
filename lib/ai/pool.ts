import { callOpenAiCompatible } from './providers/openaiCompatible';
import { ProviderCallError, PROVIDER_LABELS } from './types';
import type { AccountConfig, AccountHealth, AccountStatusView, ProviderId, UsageEvent } from './types';

const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const AUTH_ERROR_COOLDOWN_MS = 60 * 60 * 1000;
const NETWORK_ERROR_COOLDOWN_MS = 10_000;
const MAX_LOG_EVENTS = 300;
const MAX_ACCOUNTS_PER_PROVIDER = 6;

/** In-memory only, by design - this app has no database (an explicit earlier decision).
 *  State here lives for as long as this server process/instance stays warm; a cold start
 *  or a second concurrent serverless instance starts with a clean slate. Good enough for
 *  "don't hammer a rate-limited key for the next N seconds" within one running process;
 *  NOT a durable, globally-consistent usage ledger across a whole deployment - that would
 *  need a shared store (Redis/KV/DB). */
const healthMap = new Map<string, AccountHealth>();
const disabledSet = new Set<string>();
const usageLog: UsageEvent[] = [];

function envBaseUrl(provider: ProviderId): string {
  return provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
}

function envModel(provider: ProviderId): string {
  if (provider === 'groq') return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function envKeyName(provider: ProviderId, index: number): string {
  const base = provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY';
  return index === 1 ? base : `${base}_${index}`;
}

/** Reads every configured account for one provider from env vars: the base key
 *  (GROQ_API_KEY) is account 1, then GROQ_API_KEY_2, GROQ_API_KEY_3, ... for more
 *  accounts on the same provider - exactly the "Provider A - Account 1/2" shape requested. */
function loadProviderAccounts(provider: ProviderId, priorityOffset: number): AccountConfig[] {
  const accounts: AccountConfig[] = [];
  for (let i = 1; i <= MAX_ACCOUNTS_PER_PROVIDER; i++) {
    const varName = envKeyName(provider, i);
    const apiKey = process.env[varName];
    if (!apiKey) continue;
    accounts.push({
      accountId: `${provider}:${i}`,
      provider,
      label: `${PROVIDER_LABELS[provider]} #${i}`,
      apiKey,
      baseUrl: envBaseUrl(provider),
      model: envModel(provider),
      priority: priorityOffset + i
    });
  }
  return accounts;
}

/** Fixed failover order: every Groq account (in declared order), then every OpenAI account -
 *  there's no live drag-to-reorder UI since persisting a custom order needs a database. To
 *  change priority, reorder which env vars you set, or add a provider between these two by
 *  extending PROVIDER_LABELS/envBaseUrl/envModel and giving it its own priority band below. */
export function loadAllAccounts(): AccountConfig[] {
  return [...loadProviderAccounts('groq', 0), ...loadProviderAccounts('openai', 100)].sort((a, b) => a.priority - b.priority);
}

function ensureHealth(accountId: string): AccountHealth {
  let h = healthMap.get(accountId);
  if (!h) {
    h = {
      status: 'unknown',
      cooldownUntil: null,
      consecutiveFailures: 0,
      lastError: null,
      lastErrorAt: null,
      lastSuccessAt: null,
      requestCount: 0,
      successCount: 0,
      failureCount: 0
    };
    healthMap.set(accountId, h);
  }
  return h;
}

function isAvailable(accountId: string): boolean {
  if (disabledSet.has(accountId)) return false;
  const h = healthMap.get(accountId);
  if (!h || h.cooldownUntil === null) return true;
  return Date.now() >= h.cooldownUntil;
}

function pushUsage(event: Omit<UsageEvent, 'id'>) {
  usageLog.unshift({ id: `${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`, ...event });
  if (usageLog.length > MAX_LOG_EVENTS) usageLog.length = MAX_LOG_EVENTS;
}

function recordSuccess(account: AccountConfig, durationMs: number) {
  const h = ensureHealth(account.accountId);
  h.status = 'healthy';
  h.cooldownUntil = null;
  h.consecutiveFailures = 0;
  h.lastSuccessAt = Date.now();
  h.requestCount++;
  h.successCount++;
  pushUsage({ timestamp: Date.now(), accountId: account.accountId, provider: account.provider, label: account.label, ok: true, durationMs });
}

function recordFailure(account: AccountConfig, err: unknown, durationMs: number) {
  const h = ensureHealth(account.accountId);
  const message = err instanceof Error ? err.message : String(err);
  const errorType = err instanceof ProviderCallError ? err.errorType : 'other';
  h.consecutiveFailures++;
  h.lastError = message;
  h.lastErrorAt = Date.now();
  h.requestCount++;
  h.failureCount++;

  const cooldownMs =
    err instanceof ProviderCallError && errorType === 'rate-limit'
      ? (err.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS / 1000) * 1000
      : errorType === 'auth'
        ? AUTH_ERROR_COOLDOWN_MS
        : NETWORK_ERROR_COOLDOWN_MS;
  h.cooldownUntil = Date.now() + cooldownMs;
  h.status = 'cooling-down';

  pushUsage({
    timestamp: Date.now(),
    accountId: account.accountId,
    provider: account.provider,
    label: account.label,
    ok: false,
    durationMs,
    errorType,
    errorMessage: message
  });
}

export interface FailoverResult {
  text: string;
  accountId: string;
  label: string;
}

/** Tries every configured, available account in priority order until one succeeds. This is
 *  the whole failover contract: Provider A Account 1 fails -> Provider A Account 2 -> Provider
 *  B Account 1 -> ... A skipped/failed account's health is updated either way, so the next
 *  call already knows to route around it while it's cooling down. */
export async function callWithFailover(prompt: string, jsonMode: boolean): Promise<FailoverResult> {
  const accounts = loadAllAccounts();
  if (accounts.length === 0) {
    throw new Error('No AI provider accounts are configured. Set GROQ_API_KEY (and optionally GROQ_API_KEY_2, OPENAI_API_KEY, ...) in your environment.');
  }

  const attempts: string[] = [];
  let sawAnyAvailable = false;

  for (const account of accounts) {
    if (!isAvailable(account.accountId)) {
      const h = healthMap.get(account.accountId);
      const reason = disabledSet.has(account.accountId)
        ? 'disabled'
        : h?.cooldownUntil
          ? `cooling down for ${Math.ceil((h.cooldownUntil - Date.now()) / 1000)}s`
          : 'unavailable';
      attempts.push(`${account.label}: skipped (${reason})`);
      continue;
    }
    sawAnyAvailable = true;
    const start = Date.now();
    try {
      const text = await callOpenAiCompatible(account, prompt, jsonMode);
      recordSuccess(account, Date.now() - start);
      return { text, accountId: account.accountId, label: account.label };
    } catch (err) {
      recordFailure(account, err, Date.now() - start);
      attempts.push(`${account.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = attempts.join(' | ');
  throw new Error(
    sawAnyAvailable
      ? `All configured AI accounts failed for this request. ${summary}`
      : `Every configured AI account is currently disabled or cooling down. ${summary}`
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function getPoolStatus(): AccountStatusView[] {
  return loadAllAccounts().map(account => {
    const h = ensureHealth(account.accountId);
    const disabledByUser = disabledSet.has(account.accountId);
    const status: AccountHealth['status'] = disabledByUser
      ? 'disabled'
      : h.cooldownUntil && Date.now() < h.cooldownUntil
        ? 'cooling-down'
        : h.requestCount === 0
          ? 'unknown'
          : 'healthy';
    return {
      accountId: account.accountId,
      provider: account.provider,
      providerLabel: PROVIDER_LABELS[account.provider],
      label: account.label,
      maskedKey: maskKey(account.apiKey),
      priority: account.priority,
      disabledByUser,
      health: { ...h, status }
    };
  });
}

export function toggleAccount(accountId: string, enabled: boolean): void {
  if (enabled) disabledSet.delete(accountId);
  else disabledSet.add(accountId);
}

export function getRecentUsage(limit = 50): UsageEvent[] {
  return usageLog.slice(0, limit);
}
