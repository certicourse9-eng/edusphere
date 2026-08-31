import { ProviderCallError, type AccountConfig } from '../types';

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; type?: string; code?: string };
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
        // Keep completions bounded so a long paper can't silently truncate mid-JSON, and so
        // a single request doesn't blow past a free-tier account's combined token budget.
        ...(jsonMode ? { response_format: { type: 'json_object' }, max_tokens: 4000 } : {})
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

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderCallError(`${account.label} response had no text content`, 'other');
  }
  return text;
}
