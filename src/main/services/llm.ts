export type ContentBlock =
  { type: 'text'; text: string } | { type: 'image'; data: string; mediaType: string }

export type Provider = 'ollama' | 'anthropic'

export interface OllamaGenerateConfig {
  provider: 'ollama'
  baseUrl: string
  modelId: string
}

export interface AnthropicGenerateConfig {
  provider: 'anthropic'
  apiKey: string
  modelId: string
}

export type GenerateConfig = OllamaGenerateConfig | AnthropicGenerateConfig

export type OutputMode = 'notes' | 'math' | 'examples'

export interface GenerateOptions {
  depth: 'concise' | 'standard' | 'detailed'
  mode: OutputMode
  custom: string
}

const INTRO =
  'You are an expert academic note-maker for university engineering lectures. You produce clean, NOTION-READY MARKDOWN that a student pastes directly into a Notion page.'

const SOURCES = `SOURCES you receive:
- Lecture slides (images, or text): the skeleton, definitions, equations, diagrams.
- Lecture transcript (text): what the lecturer actually SAID. This carries the intuition, worked reasoning, examples, emphasis, and exam cues ("this comes up in the exam", "the key thing is...", "students always get this wrong"). Ignore filler, timestamps, and speaker artifacts.`

const NOTION_FORMAT_RULES = `OUTPUT FORMAT — strict Notion-compatible markdown:
- Only 3 heading levels exist in Notion. Use # for major sections, ## for subsections, ### sparingly.
- **Bold** key terms and final answers.
- Bullet lists with "- " and numbered lists with "1. ". Keep bullets tight.
- For intuition/insight use a quote line:  > 💡 **Intuition:** ...
- For common mistakes / exam traps use:      > ⚠️ **Watch out:** ...
- For definitions you may use:                > 📖 **Definition:** ...
- Equations: use plain LaTeX. Block equations on their own line, as either $$ ... $$ or \\[ ... \\]; inline math as either $ ... $ or \\( ... \\). Do NOT wrap equations in code blocks.
- Code (if any) in fenced blocks with a language tag.
- Comparisons/contrasts as markdown tables.
- Use --- as a divider between major sections.
- Do NOT use HTML. Do NOT use toggle syntax or callout syntax like "> [!note]" (Notion won't parse it).`

// Stable, task-neutral system prompt. It is byte-identical for every output mode AND for the
// verification pass, so the slide images + transcript cached beneath it (prompt caching is a strict
// prefix match) are reused across both passes. The specific task is given in the final user turn.
export function buildBaseSystemPrompt(): string {
  return `${INTRO}

${SOURCES}

${NOTION_FORMAT_RULES}

Every response returns EXACTLY this shape, nothing before or after:
===TITLE===
<the page title, per the task's title instruction>
===NOTES===
<the markdown body>`
}

const FIGURE_INSTRUCTIONS = `FIGURES: You are also given extracted slide figures, each shown right after a line "Figure N.k:" (N = slide, k = figure on that slide). Where one of these figures materially helps understanding — a diagram, plot, chart, circuit, worked figure, or a photo the notes discuss — embed it INLINE on its own line, next to the relevant text, using exactly this syntax:
![short caption](figure:N.k)
Rules: only embed figures that genuinely add value; never embed logos, decorative images, headshots, or text-only screenshots. Reference each figure at most once. Keep the caption short. If no figure is worth embedding, embed none. Do not invent figure ids — only use ids you were actually given.`

const MATH_TASK = `TASK — build a MATH REFERENCE SHEET for this lecture: pull out every formula, equation, constant, and key quantity — and nothing else.
- Every formula/equation the lecture states or derives, written as a block equation ($$ ... $$).
- Directly under each equation, a one-line "where: ..." gloss defining each symbol and its SI unit.
- All physical/material constants and given numeric values, with the value AND its units.
- Key derived relationships and identities, grouped under the topic/section they belong to.
- Note any important assumption or condition a formula requires (e.g. "incompressible, steady flow").
Do NOT write prose overviews, explanations, or a summary — this is a reference sheet, not notes. Do NOT include worked examples. Keep annotations terse. Preserve the lecturer's exact notation/symbols. Group with ## headings by topic, ordered to match the lecture flow.
For ===TITLE===, copy the lecture title from the slides verbatim, then append " — Formulas".`

const EXAMPLES_TASK = `TASK — produce the WORKED EXAMPLES for this lecture: extract ONLY the worked examples/problems and present each one fully worked, step by step.
- Find every worked example, example problem, or "let's do one" the lecturer works through (slides or transcript). Include those ONLY — no general notes, no theory dump, no summary.
- For each example use a "## Example N — <short description>" heading, then:
  1. **Problem:** state what is given and what is asked, as posed.
  2. **Solution:** number the steps. For each step show the reasoning AND the math as a block equation, carrying units through. Pull in the lecturer's spoken reasoning from the transcript. If a step uses a formula, write the formula first, then substitute the numbers.
  3. **Answer:** state the final result in **bold**, with units.
- Be genuinely detailed — show every step a student needs to reproduce it.
- If the lecture contains NO worked examples, return a single line under the title saying so.
For ===TITLE===, copy the lecture title from the slides verbatim, then append " — Worked Examples".`

function notesTask(depthLine: string): string {
  return `TASK — write full study notes for this lecture.
Depth: ${depthLine}
SYNTHESISE, do not transcribe: use the slides for structure and precise statements, and the transcript for the "why", the intuition, and anything the lecturer stressed that isn't on the slide. If they conflict, prefer the transcript's explanation but keep the slide's exact definition/formula.
STRUCTURE:
1. A one-paragraph overview of what the lecture is about.
2. (If useful) a short "Key terms" bullet list.
3. The main content in logical sections following the lecture flow.
4. A short "Summary / takeaways" section at the end.
Be thorough but not padded. Prefer clarity over length.
For ===TITLE===, copy the lecture title from the slides verbatim — do not invent, paraphrase, or improve it.`
}

// The generate task, delivered as the final user turn (after the cached source). Carries the mode,
// depth, unit/topic, any student custom instructions, and figure-embedding rules.
export function buildTaskInstruction(
  unit: string,
  topic: string,
  opts: GenerateOptions,
  hasFigures = false
): string {
  const depthMap: Record<GenerateOptions['depth'], string> = {
    concise: 'Concise: hit only the load-bearing points, keep it skimmable.',
    standard: 'Standard: solid revision notes with the key reasoning included.',
    detailed: 'Detailed: comprehensive notes that could replace re-watching the lecture.'
  }
  const modeSpec =
    opts.mode === 'math'
      ? MATH_TASK
      : opts.mode === 'examples'
        ? EXAMPLES_TASK
        : notesTask(depthMap[opts.depth])
  return `UNIT: ${unit}
TOPIC / SECTION: ${topic}

${modeSpec}
${opts.custom.trim() ? `\nADDITIONAL INSTRUCTIONS FROM THE STUDENT — follow these, they take priority over the defaults above where they conflict:\n${opts.custom.trim()}\n` : ''}${hasFigures ? '\n' + FIGURE_INSTRUCTIONS + '\n' : ''}`
}

// The verification task, delivered as the final user turn on a second pass. Reuses the exact same
// cached system + source prefix, so re-reading the slide images is cheap. Corrects the draft against
// the source and returns the full corrected notes.
export function buildVerifyInstruction(draft: string): string {
  return `You are now CHECKING a draft for accuracy against the SOURCE above (the lecture slides and transcript). You are NOT writing new notes.

Go through the draft and fix anything the source does not support:
- Wrong or invented numbers, values, constants, or reference points (e.g. specific readings/coordinates not actually shown in the source).
- Incorrect formulas, algebra, signs, units, or definitions.
- Statements that contradict the slides or transcript.
Where the source states a value or formula, that is the source of truth — match it. If a claim cannot be supported from the source, correct it or remove it.

Change ONLY what is wrong. Preserve everything else exactly: wording, structure, headings, tables, equation formatting, any inline figure markers of the form ![caption](figure:N.k), and the ===TITLE===/===NOTES=== shape (keep the title verbatim, including any " — Formulas" / " — Worked Examples" suffix). Do not rewrite, reorganise, add, or drop content that is already correct.

Return the full corrected notes in the exact ===TITLE===/===NOTES=== shape.

DRAFT TO CHECK:
${draft}`
}

const NUM_CTX = 12288
const NUM_PREDICT = 8000
const MAX_TOKENS = 8000
const CONTINUATION_PROMPT =
  'Continue the notes from exactly where you stopped. Do not repeat anything already written, do not add any preamble — just carry straight on.'

interface OllamaStreamLine {
  message?: { role: string; content: string }
  done?: boolean
  done_reason?: string
  error?: string
}

// Ollama buffers the entire response server-side when stream:false, sending zero bytes until
// generation fully completes — for a slow local model that easily exceeds Node fetch's default
// headers timeout. Streaming (NDJSON lines) gets headers back in seconds and lets progress update
// incrementally, which also matches the app's existing "live progress" UI.
async function streamChat(
  baseUrl: string,
  modelId: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string; images?: string[] }>,
  onChunk: (chunk: string) => void
): Promise<{ content: string; doneReason?: string }> {
  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        stream: true,
        messages,
        options: { num_ctx: NUM_CTX, num_predict: NUM_PREDICT }
      })
    })
  } catch (e) {
    throw new Error(
      `Can't reach Ollama at ${baseUrl} (${(e as Error).message}). Make sure it's running: \`ollama serve\` (or open the Ollama app).`
    )
  }
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Ollama API ${resp.status}: ${txt.slice(0, 300)}`)
  }

  let content = ''
  let doneReason: string | undefined
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      const obj = JSON.parse(line) as OllamaStreamLine
      if (obj.error) throw new Error(obj.error)
      if (obj.message?.content) {
        content += obj.message.content
        onChunk(content)
      }
      if (obj.done) doneReason = obj.done_reason
    }
  }
  return { content, doneReason }
}

async function generateNotesOllama(
  baseUrl: string,
  modelId: string,
  contentBlocks: ContentBlock[],
  systemPrompt: string,
  onProgress: (fullText: string) => void
): Promise<string> {
  const text = contentBlocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
  const images = contentBlocks
    .filter((b): b is { type: 'image'; data: string; mediaType: string } => b.type === 'image')
    .map((b) => b.data)

  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
    images?: string[]
  }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text, ...(images.length ? { images } : {}) }
  ]

  let full = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const { content: chunk, doneReason } = await streamChat(baseUrl, modelId, messages, (partial) =>
      onProgress(full + partial)
    )
    full += chunk
    onProgress(full)
    if (doneReason === 'length') {
      messages.push({ role: 'assistant', content: chunk })
      messages.push({ role: 'user', content: CONTINUATION_PROMPT })
    } else {
      break
    }
  }
  return full
}

type CacheControl = { type: 'ephemeral' }

type AnthropicContentBlock =
  | { type: 'text'; text: string; cache_control?: CacheControl }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: string; data: string }
      cache_control?: CacheControl
    }

function toAnthropicContent(blocks: ContentBlock[]): AnthropicContentBlock[] {
  return blocks.map((b) =>
    b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } }
  )
}

// Marks the last block as a prompt-cache breakpoint. The cache stores the entire prefix up to (and
// including) that block — system + every source block — so a second call with the same prefix (the
// verification pass) reads it back at ~0.1x instead of re-billing the slide images at full price.
function withCacheBreakpoint(blocks: AnthropicContentBlock[]): AnthropicContentBlock[] {
  if (blocks.length === 0) return blocks
  const last = blocks.length - 1
  return blocks.map((b, i) => (i === last ? { ...b, cache_control: { type: 'ephemeral' } } : b))
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  stop_reason?: string
  error?: { message?: string }
  usage?: {
    input_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

// One Anthropic call (with the continuation loop for max_tokens). Layout is cache-friendly: the
// stable system prompt + the source blocks form a cached prefix, and the task-specific instruction
// is a separate trailing user turn. Non-streaming — Anthropic's cloud latency is low enough to avoid
// the headers-timeout issue that forced the Ollama path onto streaming.
async function callAnthropic(
  apiKey: string,
  modelId: string,
  baseSystem: string,
  sourceBlocks: ContentBlock[],
  instruction: string,
  onProgress: (fullText: string) => void
): Promise<string> {
  const messages: Array<{ role: 'user' | 'assistant'; content: AnthropicContentBlock[] | string }> =
    [
      { role: 'user', content: withCacheBreakpoint(toAnthropicContent(sourceBlocks)) },
      { role: 'user', content: [{ type: 'text', text: instruction }] }
    ]

  let full = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    let resp: Response
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: MAX_TOKENS,
          system: baseSystem,
          messages
        })
      })
    } catch (e) {
      throw new Error(
        `Couldn't reach Anthropic's API (${(e as Error).message}). Check your internet connection.`
      )
    }
    if (!resp.ok) {
      // Response body only — never echoes back request headers, so the API key can't leak here.
      const data = (await resp.json().catch(() => ({}))) as AnthropicResponse
      throw new Error(data.error?.message || `Anthropic API ${resp.status}`)
    }
    const data = (await resp.json()) as AnthropicResponse
    const u = data.usage
    if (u) {
      // Confirms prompt caching is working — cache_read should be large on the verification pass.
      console.log(
        `[notely] anthropic usage — input:${u.input_tokens ?? '?'} cache_write:${u.cache_creation_input_tokens ?? 0} cache_read:${u.cache_read_input_tokens ?? 0}`
      )
    }
    const chunk = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('')
    full += chunk
    onProgress(full)
    if (data.stop_reason === 'max_tokens') {
      messages.push({ role: 'assistant', content: chunk })
      messages.push({ role: 'user', content: CONTINUATION_PROMPT })
    } else {
      break
    }
  }
  return full
}

export interface GeneratedNotes {
  raw: string
  verified: boolean
}

export async function generateNotes(
  config: GenerateConfig,
  sourceBlocks: ContentBlock[],
  baseSystem: string,
  instruction: string,
  onProgress: (fullText: string) => void
): Promise<GeneratedNotes> {
  if (config.provider === 'anthropic') {
    const draft = await callAnthropic(
      config.apiKey,
      config.modelId,
      baseSystem,
      sourceBlocks,
      instruction,
      onProgress
    )
    // Always run a second pass that re-reads the source and corrects the draft against it. It reuses
    // the cached system + source prefix, so the (large) slide images cost ~0.1x here. If it fails
    // for any reason, fall back to the unverified draft rather than losing the work.
    try {
      const checked = await callAnthropic(
        config.apiKey,
        config.modelId,
        baseSystem,
        sourceBlocks,
        buildVerifyInstruction(draft),
        onProgress
      )
      return { raw: checked, verified: true }
    } catch (e) {
      console.warn('[notely] accuracy check failed, using unverified draft:', (e as Error).message)
      return { raw: draft, verified: false }
    }
  }

  // Ollama: single pass, no prompt caching and no verification. The task instruction rides along as
  // the final text block; the base system prompt stays task-neutral.
  const raw = await generateNotesOllama(
    config.baseUrl,
    config.modelId,
    [...sourceBlocks, { type: 'text', text: instruction }],
    baseSystem,
    onProgress
  )
  return { raw, verified: false }
}

export function parseOutput(raw: string, topic: string): { title: string; notes: string } {
  const notesSplit = raw.split(/===NOTES===/)
  if (notesSplit.length >= 2) {
    const title = notesSplit[0].replace(/===TITLE===/, '').trim()
    const notes = notesSplit.slice(1).join('===NOTES===').trim()
    return { title: title || topic, notes }
  }
  return { title: topic || 'Lecture notes', notes: raw.trim() }
}

export async function checkOllamaConnection(
  baseUrl: string,
  modelId: string
): Promise<{ ok: boolean; error?: string }> {
  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/api/tags`)
  } catch {
    return {
      ok: false,
      error: `Can't reach Ollama at ${baseUrl}. Make sure it's running: \`ollama serve\` (or \`brew services start ollama\`).`
    }
  }
  if (!resp.ok) {
    return { ok: false, error: `Ollama responded with ${resp.status}.` }
  }
  const data = (await resp.json()) as { models?: Array<{ name?: string; model?: string }> }
  const installed = (data.models || []).some((m) => m.name === modelId || m.model === modelId)
  if (!installed) {
    return {
      ok: false,
      error: `Ollama is running, but "${modelId}" isn't pulled yet. Run: \`ollama pull ${modelId}\``
    }
  }
  return { ok: true }
}

// Anthropic has no free "ping" endpoint, so this spends a trivial 1 output token (a fraction
// of a cent) on a real request to genuinely confirm the key + model combination works, rather
// than just checking the key is present.
export async function checkAnthropicKey(
  apiKey: string,
  modelId: string
): Promise<{ ok: boolean; error?: string }> {
  let resp: Response
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
    })
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't reach Anthropic's API (${(e as Error).message}). Check your internet connection.`
    }
  }
  if (resp.ok) return { ok: true }
  if (resp.status === 401) return { ok: false, error: 'Invalid API key.' }
  const data = (await resp.json().catch(() => ({}))) as AnthropicResponse
  return { ok: false, error: data.error?.message || `Anthropic API ${resp.status}` }
}
