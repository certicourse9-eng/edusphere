import { ProviderCallError, type AccountConfig } from '../types';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string; type?: string; code?: string };
}

/** This account's tier caps combined prompt+completion tokens at 8000 per request (found
 *  empirically from live rate-limit errors). A fixed completion budget either wastes headroom
 *  on short prompts or truncates the JSON mid-object on long/detailed ones (many
 *  questions x many criteria x evidence/missing text easily exceeds a flat 4000). Scale the
 *  completion budget to whatever's left after a rough estimate of the prompt's own size. */
const COMBINED_TOKEN_CAP = 8000;
const RESPONSE_SAFETY_MARGIN = 200;
const MIN_COMPLETION_TOKENS = 1500;
const MAX_COMPLETION_TOKENS = 6500;

function estimateMaxTokens(prompt: string): number {
  const estimatedPromptTokens = Math.ceil(prompt.length / 4);
  const available = COMBINED_TOKEN_CAP - estimatedPromptTokens - RESPONSE_SAFETY_MARGIN;
  return Math.max(MIN_COMPLETION_TOKENS, Math.min(MAX_COMPLETION_TOKENS, available));
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

/** Calls any OpenAI-compatible /chat/completions endpoint (Groq, OpenAI itself, and most
 *  other hosted-inference providers share this exact request/response shape). One adapter
 *  serves every such provider - only baseUrl/apiKey/model differ per account. */
export async function callOpenAiCompatible(account: AccountConfig, prompt: string, jsonMode: boolean): Promise<string> {
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
        // Bounded so a single request doesn't blow past this tier's combined token budget,
        // but scaled to the prompt so a detailed paper still has room to finish its JSON
        // instead of getting cut off mid-object (see estimateMaxTokens above).
        ...(jsonMode ? { response_format: { type: 'json_object' }, max_tokens: estimateMaxTokens(prompt) } : {})
      })
    });
  } catch (err) {
    throw new ProviderCallError(`Could not reach ${account.label}: ${(err as Error).message}`, 'network');
  }

  let data: ChatCompletionResponse;
  try {
    data = await resp.json();
  } catch {
    throw new ProviderCallError(`${account.label} returned a non-JSON response (status ${resp.status})`, 'other');
  }

  if (!resp.ok) {
    const rawMessage = data.error?.message || `${account.label} error (status ${resp.status})`;
    const errorType = classifyError(resp, rawMessage);
    if (/request too large/i.test(rawMessage)) {
      throw new ProviderCallError(
        `${account.label}: this paper is too long/text-heavy for this account's per-request token limit.`,
        'other'
      );
    }
    throw new ProviderCallError(rawMessage, errorType, errorType === 'rate-limit' ? parseRetryAfterSeconds(resp, rawMessage) : null);
  }

  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    throw new ProviderCallError(`${account.label} response had no text content`, 'other');
  }
  if (choice?.finish_reason === 'length') {
    throw new ProviderCallError(
      `${account.label}: the response was cut off before it finished (too much output for this paper's length/detail). Try re-grading it, or if it keeps happening, this paper may need to be split into a shorter excerpt.`,
      'other'
    );
  }
  return text;
}
