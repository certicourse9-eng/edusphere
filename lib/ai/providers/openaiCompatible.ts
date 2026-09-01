import { ProviderCallError, type AccountConfig, type ProviderId } from '../types';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string; type?: string; code?: string };
}

/** Groq's free tier caps combined prompt+completion tokens at 8000 per request (found
 *  empirically from live rate-limit errors). OpenAI and OpenRouter's hosted models have a
 *  much larger context window, so they aren't held to that same tight cap. A fixed completion
 *  budget either wastes headroom on short prompts or truncates the JSON mid-object on
 *  long/detailed ones (many questions x many criteria x evidence/missing text easily exceeds
 *  a flat 4000) - so the completion budget scales to whatever's left after a rough estimate
 *  of the prompt's own size, per provider. */
const COMBINED_TOKEN_CAP: Record<ProviderId, number> = {
  groq: 8000,
  openai: 100_000,
  openrouter: 100_000
};
const RESPONSE_SAFETY_MARGIN = 200;
const MIN_COMPLETION_TOKENS = 1500;
const MAX_COMPLETION_TOKENS = 6500;

/** Returns null when even the minimum viable completion wouldn't fit under this provider's
 *  combined cap - the prompt itself (i.e. the paper's OCR text) is too long, not a completion
 *  we can just shrink further. Forcing a minimum floor here regardless of fit was the bug:
 *  it could push prompt+completion back OVER the cap and get rejected as "request too large"
 *  even after already trying to budget for it. */
function estimateMaxTokens(provider: ProviderId, prompt: string): number | null {
  const cap = COMBINED_TOKEN_CAP[provider];
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const available = cap - estimatedPromptTokens - RESPONSE_SAFETY_MARGIN;
  if (available < MIN_COMPLETION_TOKENS) return null;
  return Math.min(MAX_COMPLETION_TOKENS, available);
}

function parseRetryAfterSeconds(resp: Response, message: string): number | null {
  const header = resp.headers.get('retry-after');
  if (header && !Number.isNaN(Number(header))) return Number(header);
  const match = message.match(/try again in ([\d.]+)\s*s/i);
  return match ? parseFloat(match[1]) : null;
}

function classifyError(resp: Response, message: string): 'rate-limit' | 'auth' | 'network' | 'other' {
  if (resp.status === 429 || /rate limit/i.test(message)) return 'rate-limit';
  if (resp.status === 401 || resp.status === 403 || /invalid api key|incorrect api key|unauthorized/i.test(message)) return 'auth';
  return 'other';
}

/** Groq and OpenAI's own models reliably support the OpenAI `response_format: json_object`
 *  param. OpenRouter fans out to many different underlying models/providers whose support
 *  for it varies (and its free-tier lineup rotates), so requiring it there risks silently
 *  breaking a fallback the moment its current free model doesn't support the param - as
 *  happened with nvidia/nemotron-3.5-lightning:free, which returned empty content rather
 *  than an error when sent a parameter it doesn't recognize. The grading prompt already
 *  instructs the model to respond with pure JSON, and parseGradingResponse already falls
 *  back to extracting a JSON object from prose/fences when strict mode isn't used - so
 *  skipping this param for OpenRouter trades a little strictness for actually working
 *  across whichever model happens to be free there. */
function supportsJsonResponseFormat(provider: AccountConfig['provider']): boolean {
  return provider === 'groq' || provider === 'openai';
}

/** Calls any OpenAI-compatible /chat/completions endpoint (Groq, OpenAI itself, and most
 *  other hosted-inference providers share this exact request/response shape). One adapter
 *  serves every such provider - only baseUrl/apiKey/model differ per account. */
export async function callOpenAiCompatible(account: AccountConfig, prompt: string, jsonMode: boolean): Promise<string> {
  // Every ProviderCallError message below is deliberately unprefixed - callWithFailover
  // (lib/ai/pool.ts) already prepends the account label once when it builds the combined
  // failover summary, so prefixing it here too would double it up (this used to render as
  // "Groq #1: Groq #1: <message>").
  let maxTokens: number | null = null;
  if (jsonMode) {
    maxTokens = estimateMaxTokens(account.provider, prompt);
    if (maxTokens === null) {
      throw new ProviderCallError(
        `this paper's extracted text is too long for a single request on this account (its combined prompt+response limit is ${COMBINED_TOKEN_CAP[account.provider]} tokens). Try an account/provider with a higher limit, or split the paper into fewer pages per upload.`,
        'other'
      );
    }
  }

  let resp: Response;
  try {
    resp = await fetch(`${account.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${account.apiKey}`
      },
      body: JSON.stringify({
        model: account.model,
        messages: [{ role: 'user', content: prompt }],
        ...(jsonMode
          ? { max_tokens: maxTokens, ...(supportsJsonResponseFormat(account.provider) ? { response_format: { type: 'json_object' } } : {}) }
          : {})
      })
    });
  } catch (err) {
    throw new ProviderCallError(`could not reach the provider: ${(err as Error).message}`, 'network');
  }

  let data: ChatCompletionResponse;
  try {
    data = await resp.json();
  } catch {
    throw new ProviderCallError(`returned a non-JSON response (status ${resp.status})`, 'other');
  }

  if (!resp.ok) {
    const rawMessage = data.error?.message || `error (status ${resp.status})`;
    const errorType = classifyError(resp, rawMessage);
    if (/request too large/i.test(rawMessage)) {
      throw new ProviderCallError(`this paper is too long/text-heavy for this account's per-request token limit.`, 'other');
    }
    throw new ProviderCallError(rawMessage, errorType, errorType === 'rate-limit' ? parseRetryAfterSeconds(resp, rawMessage) : null);
  }

  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    throw new ProviderCallError(`response had no text content`, 'other');
  }
  if (choice?.finish_reason === 'length') {
    throw new ProviderCallError(
      `the response was cut off before it finished (too much output for this paper's length/detail). Try re-grading it, or if it keeps happening, this paper may need to be split into a shorter excerpt.`,
      'other'
    );
  }
  return text;
}
