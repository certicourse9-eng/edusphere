# EduSphere (Next.js)

A teacher-facing tool that bulk-uploads scanned IB answer-sheet PDFs and
grades them: **PaddleOCR** reads each PDF, then **Groq** (running OpenAI's
open-weight GPT-OSS 120B) reasons over the extracted text against
IB-style marking criteria to produce suggested marks and feedback. Both
API keys are read server-side only — neither ever reaches the browser.
Both services have genuinely free tiers with no billing/card requirement.

```
Upload PDF → Next.js API route → PaddleOCR → extracted text
  → question/answer split → Groq/GPT-OSS (LLM reasoning) → IB marking criteria
  → suggested marks + feedback → teacher review
```

## Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local: add your Groq key and PaddleOCR token
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Get a Groq API key at [console.groq.com/keys](https://console.groq.com/keys)
— sign in with Google/GitHub, generate a key immediately. Free tier, no
card required.

## PaddleOCR (the OCR step)

`app/api/ocr/route.ts` is a server-side route that calls the hosted
PaddleOCR job API at [paddleocr.aistudio-app.com](https://paddleocr.aistudio-app.com).
It's an async job API: submit the PDF, poll `GET .../jobs/{jobId}` every 5s
until the job is `done` (or `failed`, or a 5-minute timeout), then fetch and
parse the JSONL result file it points to. The access token
(`PADDLEOCR_ACCESS_TOKEN` in `.env.local`) is read only server-side and
never reaches the browser.

> **One thing worth double-checking on your first real run**: the reference
> script this was built from only demonstrates downloading the *visualized
> OCR image* per page (`ocrImage`), not the recognized text itself.
> `extractPageText()` in `app/api/ocr/route.ts` assumes the recognized text
> sits at `result.ocrResults[].prunedResult.rec_texts` (PaddleX's standard
> OCR pipeline output shape) — this is inferred, not confirmed against a
> live response. If a real run comes back with "no recognized text
> (rec_texts) was found," the field is named differently; log the raw
> `ocrResults[0]` object from a real job and adjust `extractPageText()` to
> match.

An earlier iteration of this route called Baidu AI Studio's synchronous
`/layout-parsing` endpoint via a separate Vercel relay (`../relay/`, used by
the standalone `answer-sheet-pipeline.html` demo) — that schema turned out
to be a guess and has been superseded by this job-based API, which comes
from a working reference script. There's also a local, self-hosted
alternative at `../ocr-service/` (runs the open-source PaddleOCR library on
your own machine instead of the hosted API) if you'd rather avoid an
external OCR service entirely — swap `app/api/ocr/route.ts` to call it via
`OCR_SERVICE_URL` if so.

## Groq (the grading/reasoning step)

`app/api/grade/route.ts` sends the OCR'd text, wrapped in an IB-marking
prompt (`lib/prompt.ts`), to Groq's OpenAI-compatible chat completions
endpoint (`POST https://api.groq.com/openai/v1/chat/completions`), running
`openai/gpt-oss-120b` by default, with `response_format: {type:
"json_object"}` so the model is constrained to return structured JSON. The
response is parsed by `lib/parseGradingResponse.ts`, which also tolerates
markdown fences or stray commentary if a model adds them anyway.

`GROQ_API_KEY` is read only inside this server-only route handler, so it's
never bundled into client-side code or sent to the browser. Without it set,
grading fails with a clear "Server is missing GROQ_API_KEY" error.
`GROQ_MODEL` defaults to `openai/gpt-oss-120b`; swap it in `.env.local`
for a different model Groq hosts if you want.

> This step has been swapped between providers several times during
> development: Claude (worked, but costs money — blocked once the trial
> credit ran out and the user didn't want to pay), a local Ollama model
> (free but only works when running the app locally, not on a deployed
> link, since a cloud server can't reach `localhost` on your machine),
> Google Gemini (blocked repeatedly by Google's account-verification/
> anti-fraud checks — "suspicious request" during key creation, then
> "denied access" requiring billing setup, on a brand-new Google Cloud
> project), Claude again (blocked by an empty credit balance), and finally
> Groq — chosen specifically because it has a genuinely free tier with no
> billing/card requirement, unlike Gemini's and Anthropic's free tiers,
> while still working on a deployed link like Ollama couldn't.
> `buildTextGradingPrompt` in `lib/prompt.ts` is provider-agnostic and
> hasn't changed through any of these; only the fetch call and response
> parsing in `app/api/grade/route.ts` differ per provider.

## How it works

1. Upload PDFs by dragging them onto the dropzone or clicking to browse.
2. Each student's ID is derived from their filename (first run of digits, or
   the filename itself if there are no digits).
3. Click **Grade sheets**. Files are processed **sequentially, one at a
   time**: each is OCR'd via `/api/ocr`, then the extracted text is sent to
   `/api/grade`, which calls Groq and returns parsed JSON (or a structured
   error) to the browser.
4. Graded students appear in the dashboard: click a row to see an animated
   score ring, an approximate grade, per-question breakdowns, the raw OCR
   text, and a place to add your own feedback (auto-saved as you type).
5. **Export CSV** downloads one row per graded student.

## Important: demo scores, not an official IB grade

The scores and the "approx. IB grade" shown here are generated by an LLM
against a made-up, fixed percentage-threshold table for demo purposes. They
are **not** real IB grade boundaries (which vary by subject and exam
session and are set by the IB) and should not be used for actual grading
decisions. Always labeled "(approx.)" in the UI as a reminder — treat every
suggested mark as a starting point for teacher review, not a final answer.

## Project structure

```
app/
  layout.tsx          Root layout, font loading
  globals.css          CSS custom properties + base styles
  page.tsx              Top-level client component, all app state
  api/grade/route.ts    Server-side grading endpoint (calls Groq, holds the API key)
  api/ocr/route.ts      Server-side PaddleOCR proxy (holds the PaddleOCR credentials)
components/            UploadPanel, FileQueue, Dashboard, StudentReportRow,
                        ScoreRing, TeacherFeedbackBox, SubjectIcon, HeroBlobs
lib/                    types, prompt builder, response parser, grade
                        bands/thresholds, subject-icon map, student ID
                        derivation, CSV export, client-side grading call
```

## Known limitations / things worth double-checking

- **Build-verified.** `npx tsc --noEmit` and `npm run build` both pass
  clean, and a grep of the built client bundle confirms neither
  `GROQ_API_KEY` nor `PADDLEOCR_ACCESS_TOKEN` leaks into it. PaddleOCR
  extraction has been exercised live on the deployed Vercel URL and
  confirmed working (the `rec_texts` field guess was correct); Groq
  grading has not yet been exercised with a real key.
- **The IB grade table is invented for this demo** (see above) — swap
  `IB_GRADE_THRESHOLDS` in `lib/gradeBands.ts` for real subject-specific
  boundaries if this is ever used for anything beyond a demo.
- **Sequential processing** is intentional — files are graded one at a time
  in `runPipeline` in `app/page.tsx`, not in parallel. This is slower for
  large batches but avoids hitting API rate limits and keeps the per-file
  status UI simple. Worth revisiting with a small concurrency limit (e.g.
  2-3 at once) if batch sizes grow.
- **Student ID derivation is naive**: "first run of digits in the filename."
  Two files like `report_2024_22104567.pdf` and `22104567_v2.pdf` would
  both correctly extract `2024` and `22104567` respectively only if the
  student number happens to be the *first* number — a filename like
  `2024_22104567.pdf` would incorrectly extract `2024`. Worth flagging to
  users or giving them an inline way to correct a student ID.
- **No de-duplication**: uploading the same file twice creates two separate
  queue entries with no warning.
