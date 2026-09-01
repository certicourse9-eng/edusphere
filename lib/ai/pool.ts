import { callOpenAiCompatible } from './providers/openaiCompatible';
import { ProviderCallError, PROVIDER_LABELS } from './types';
import type { AccountConfig, AccountHealth, AccountStatusView, ProviderId, UsageEvent } from './types';

const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const AUTH_ERROR_COOLDOWN_MS = 60 * 60 * 1000;
const NETWORK_ERROR_COOLDOWN_MS = 10_000;
const MAX_LOG_EVENTS = 300;
const MAX_ACCOUNTS_PER_PROVIDER = 6;
/** A rate limit this short is almost always a per-minute token budget that's about to
 *  refill, not a real outage - waiting it out and retrying the SAME account beats jumping
 *  straight to cooldown+failover, especially with only one account configured (where
 *  "failover" would otherwise mean "fail immediately with nowhere else to go"). A large
 *  paper's request size can land close enough to the per-minute cap that the provider's
 *  own suggested wait is 12-15s - seen live at 13.2s, just over the previous 12s
 *  threshold, which meant an easily-recoverable near-miss failed over instead of just
 *  waiting the extra second. 20s comfortably covers that case with room to spare. */
const SHORT_RATE_LIMIT_WAIT_MS = 20_000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  if (provider === 'groq') return 'https://api.groq.com/openai/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  // Google's own OpenAI-compatible endpoint - same request/response shape as every other
  // account here, so it plugs into the shared adapter with no special-casing.
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/openai';
  return 'https://api.openai.com/v1';
}

function envModel(provider: ProviderId): string {
  if (provider === 'groq') return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  // Free-tier by default - this project otherwise runs entirely on free-tier accounts
  // (Groq). OpenRouter has progressively dropped free access to the well-known models
  // (Llama, Gemini, etc. no longer have a free variant there), so this uses one of the
  // few that's still genuinely free: Nemotron 3.5 Lightning, with a 1,000,000-token
  // context window - vastly more than Groq's 8000-token combined cap, making this the
  // fallback for exactly the case Groq can't handle: a paper too long/text-heavy for a
  // single request. Override with OPENROUTER_MODEL if OpenRouter's free lineup changes
  // again or you'd rather point this at a paid model.
  if (provider === 'openrouter') return process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-3.7-flash';
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function envKeyName(provider: ProviderId, index: number): string {
  const base =
    provider === 'groq'
      ? 'GROQ_API_KEY'
      : provider === 'openrouter'
        ? 'OPENROUTER_API_KEY'
        : provider === 'gemini'
          ? 'GEMINI_API_KEY'
          : 'OPENAI_API_KEY';
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

/** Fixed failover order: Groq, then Gemini, then OpenRouter, then OpenAI (each provider's
 *  own accounts tried in declared order) - there's no live drag-to-reorder UI since
 *  persisting a custom order needs a database. Gemini and OpenRouter both sit before OpenAI
 *  because they're free-tier options (matching Groq) with a much higher per-request token
 *  limit, making them the natural fallback for a paper too long for Groq's cap. Gemini goes
 *  first between the two - it's a known, stable model, vs. OpenRouter's free lineup which
 *  rotates over time (see envModel). To change priority, reorder which env vars you set, or
 *  add a provider by extending PROVIDER_LABELS/envBaseUrl/envModel and giving it its own
 *  priority band below. */
export function loadAllAccounts(): AccountConfig[] {
  return [
    ...loadProviderAccounts('groq', 0),
    ...loadProviderAccounts('gemini', 25),
    ...loadProviderAccounts('openrouter', 50),
    ...loadProviderAccounts('openai', 100)
  ].sort((a, b) => a.priority - b.priority);
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
      // A short rate-limit wait is worth riding out on the SAME account before treating it
      // as a failure at all - jumping straight to cooldown+failover here would mean "only
      // one account configured" always fails outright on a routine per-minute limit instead
      // of just waiting a few seconds, which is what a teacher would do by hand anyway.
      if (err instanceof ProviderCallError && err.errorType === 'rate-limit' && err.retryAfterSeconds !== null && err.retryAfterSeconds * 1000 <= SHORT_RATE_LIMIT_WAIT_MS) {
        await sleep(err.retryAfterSeconds * 1000);
        const retryStart = Date.now();
        try {
          const text = await callOpenAiCompatible(account, prompt, jsonMode);
          recordSuccess(account, Date.now() - retryStart);
          return { text, accountId: account.accountId, label: account.label };
        } catch (retryErr) {
          recordFailure(account, retryErr, Date.now() - retryStart);
          attempts.push(`${account.label}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)} (after waiting ${err.retryAfterSeconds.toFixed(1)}s and retrying once)`);
          continue;
        }
      }
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
