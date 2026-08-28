# EduSphere (Next.js)

A teacher-facing tool that bulk-uploads scanned IB student work and grades
it. The teacher first picks a **coursework type** — Internal Assessment,
Extended Essay, TOK essay/exhibition, or External Assessment — and (for
everything except TOK) a **subject**. **PaddleOCR** reads each PDF, then
**Groq** (running OpenAI's open-weight GPT-OSS 120B) verifies the content
matches the selected subject before grading it against criteria specific
to that *combination* of coursework type and subject — an Internal
Assessment and an exam answer sheet in the same subject use genuinely
different criteria, matching how IB actually structures assessment. If the
content clearly belongs to a different subject than the one picked, the
sheet is flagged as a mismatch instead of graded. Both API keys are read
server-side only — neither ever reaches the browser. Both services have
genuinely free tiers with no billing/card requirement.

```
Upload PDF (coursework type + subject pre-selected) → Next.js API route
  → PaddleOCR → extracted text
  → subject verification (Groq, skipped for TOK) → match? → criteria for
    this coursework type + subject         → mismatch? → flagged, not graded
  → grading pass (Groq) → suggested marks + feedback → teacher review
```

Selecting **"General / Other"** as the subject skips verification entirely
and always grades with general criteria — there's nothing to mismatch
against. **Extended Essay** and **TOK** are graded as one continuous piece
of writing (their own fixed, subject-agnostic criteria), not split into
question/answer pairs like an exam sheet or IA.

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

## Groq (subject verification + grading/reasoning)

`app/api/grade/route.ts` accepts the teacher's selected `subject` plus the
OCR'd text, and (unless `subject` is `General / Other`) makes **two** Groq
calls per sheet:

1. **Verification**: `buildSubjectDetectionPrompt` (`lib/prompt.ts`) asks
   the model to classify the OCR'd text against the known subject list
   (`lib/subjectIcons.ts`), independent of what the teacher picked, or
   respond `General / Other` if none clearly match. The raw response is
   normalized/validated against that list server-side
   (`normalizeDetectedSubject`) — anything that doesn't exactly match a
   known subject, or a failed call, falls back to `General / Other`.
   - If the detected subject is a **specific subject different from** the
     teacher's selection, the route returns immediately with a
     `"Subject mismatch: ..."` error and empty scores (`mismatchResult` in
     `app/api/grade/route.ts`) — no grading call is made.
   - If detection matches, or comes back inconclusive (`General / Other`),
     grading proceeds using the **teacher's selected subject** (giving the
     benefit of the doubt when detection itself is uncertain, rather than
     blocking on it).
2. **Grading**: `buildTextGradingPrompt` is built using the selected
   subject's assessment objectives (`lib/subjectObjectives.ts` — real,
   distinct objectives per subject group: sciences, math, individuals &
   societies, language & literature; not one generic rubric for everything).

Both calls go to Groq's OpenAI-compatible chat completions endpoint
(`POST https://api.groq.com/openai/v1/chat/completions`), running
`openai/gpt-oss-120b` by default. The grading call uses `response_format:
{type: "json_object"}` so the model is constrained to return structured
JSON; the response is parsed by `lib/parseGradingResponse.ts`, which also
tolerates markdown fences or stray commentary if a model adds them anyway.
The subject actually used (or, on mismatch, the one detected instead) is
attached to the result (`detectedSubject`) and shown in the report, the
mark-sheet table, and the CSV export.

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

## Coursework types and criteria (`lib/subjectObjectives.ts`)

Four coursework types, each with its own criteria structure:

- **External Assessment** — exam-style answer sheets. Per-subject-group
  criteria (4 criteria, AO-style: e.g. Knowledge and understanding,
  Application, Analysis and evaluation, Communication for sciences).
- **Internal Assessment** — coursework, genuinely different criteria from
  the exam AOs even in the same subject (e.g. sciences IA uses Personal
  engagement / Exploration / Analysis / Evaluation / Communication instead).
- **Extended Essay** — subject-agnostic, fixed A-E criteria (Focus and
  method, Knowledge and understanding, Critical thinking, Presentation,
  Engagement; 34 points total, matching the real EE point structure).
- **TOK essay/exhibition** — subject-agnostic, fixed criteria. Real TOK
  essays are officially marked with a single holistic impression rather
  than separate weighted criteria; this app breaks it into named
  components anyway purely to give more specific, actionable feedback —
  that's a deliberate simplification for this demo, not the official
  method.

> **Accuracy note**: criterion *names* and *point totals* for External/
> Internal Assessment and the Extended Essay follow the general shape of
> real, published IB DP assessment objectives/criteria as a good-faith
> approximation. The *description* text for every criterion was written
> originally for this demo, not copied from official IB subject guides or
> markschemes (which are copyrighted and, for IA/exam papers, specific to
> each subject's actual published guide — something a generic tool like
> this can't reproduce exactly). Treat every criterion here as an
> approximation to verify against the current official subject guide, not
> an authoritative source.

`getCriteria(courseworkType, subject)` selects the right set;
`buildTextGradingPrompt` (`lib/prompt.ts`) branches into two shapes:
Internal/External Assessment split the OCR'd text into multiple
question/answer pairs (existing behaviour); Extended Essay/TOK treat the
whole OCR'd text as ONE continuous piece and grade it holistically as a
single `GradedQuestion` entry — no schema fork needed, the existing
questions-array UI just always has exactly one item for those two types.

## How it works

1. Pick the **coursework type**, then (for everything except TOK) the
   **Subject** and, for Internal/External Assessment, the **Level**.
2. Upload PDFs by dragging them onto the dropzone or clicking to browse.
3. Each student's ID is derived from their filename (first run of digits, or
   the filename itself if there are no digits).
4. Click **Grade sheets**. Files are processed **sequentially, one at a
   time**: each is OCR'd via `/api/ocr`, then the extracted text is sent to
   `/api/grade`, which verifies the content matches the selected subject,
   grades against that subject's criteria if it does, or returns a subject
   mismatch (no scores) if it doesn't.
5. Graded students appear in the dashboard: click a row to see the subject
   that was actually used (or detected, if it mismatched), an animated
   score ring, an approximate grade, per-question breakdowns, the raw OCR
   text, and a place to add your own feedback (auto-saved as you type).
6. **Export CSV** downloads one row per graded student.

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
lib/                    types, prompt builder (detection + grading), response
                        parser, grade bands/thresholds, subject-icon map,
                        per-subject assessment objectives, student ID
                        derivation, CSV export, client-side grading call
```

## Known limitations / things worth double-checking

- **Build-verified and live-tested.** `npx tsc --noEmit` and `npm run build`
  both pass clean, and a grep of the built client bundle confirms neither
  `GROQ_API_KEY` nor `PADDLEOCR_ACCESS_TOKEN` leaks into it. Both PaddleOCR
  extraction and the full detect-then-grade Groq flow have been exercised
  live against the deployed Vercel URL and confirmed working, including
  correct subject differentiation (same answer text graded differently,
  and correctly, when it actually belongs to different subjects) and the
  `General / Other` fallback for unclassifiable content.
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
