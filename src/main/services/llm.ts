export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: string }

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

export interface GenerateOptions {
  depth: 'concise' | 'standard' | 'detailed'
  terms: boolean
  summary: boolean
  custom: string
}

export function buildSystemPrompt(): string {
  return `You are an expert academic note-maker. You turn university engineering lecture materials into clean, well-structured study notes formatted as NOTION-READY MARKDOWN that a student pastes directly into a Notion page.

SOURCES you receive:
- Lecture slides (images, or text): the skeleton, definitions, equations, diagrams.
- Lecture transcript (text): what the lecturer actually SAID. This carries the intuition, worked reasoning, examples, emphasis, and exam cues ("this comes up in the exam", "the key thing is...", "students always get this wrong"). Ignore filler, timestamps, and speaker artifacts.

SYNTHESISE, do not transcribe. Merge the two: use slides for structure and precise statements, use the transcript to add the "why", the intuition, and anything the lecturer stressed that isn't on the slide. If they conflict, prefer the transcript's explanation but keep the slide's exact definition/formula.

OUTPUT FORMAT — strict Notion-compatible markdown:
- Only 3 heading levels exist in Notion. Use # for major sections, ## for subsections, ### sparingly.
- **Bold** every key term the first time it appears.
- Bullet lists with "- " and numbered lists with "1. ". Keep bullets tight.
- For intuition/insight use a quote line:  > 💡 **Intuition:** ...
- For common mistakes / exam traps use:      > ⚠️ **Watch out:** ...
- For definitions you may use:                > 📖 **Definition:** ...
- Equations: use plain LaTeX. Block equations on their own line, as either $$ ... $$ or \\[ ... \\]; inline math as either $ ... $ or \\( ... \\). Do NOT wrap equations in code blocks.
- Code (if any) in fenced blocks with a language tag.
- Comparisons/contrasts as markdown tables.
- Use --- as a divider between major sections.
- Do NOT use HTML. Do NOT use toggle syntax or callout syntax like "> [!note]" (Notion won't parse it).

STRUCTURE the notes as:
1. A one-paragraph overview of what the lecture is about.
2. (If useful) a short "Key terms" bullet list.
3. The main content in logical sections following the lecture flow.
4. A short "Summary / takeaways" section at the end.

Be thorough but not padded. Prefer clarity over length. Write in the second person is not needed — write as neat reference notes.

RETURN EXACTLY this shape, nothing before or after:
===TITLE===
<the title as it actually appears on the lecture slides themselves — copy it from the title/front slide (or the first slide's heading) verbatim or as close to verbatim as possible. Do NOT invent, paraphrase, or improve it — use what the slides actually say, not your own summary of the lecture>
===NOTES===
<the full markdown notes>`
}

export function buildInstruction(unit: string, topic: string, opts: GenerateOptions): string {
  const depthMap: Record<GenerateOptions['depth'], string> = {
    concise: 'Concise: hit only the load-bearing points, keep it skimmable.',
    standard: 'Standard: solid revision notes with the key reasoning included.',
    detailed: 'Detailed: comprehensive notes that could replace re-watching the lecture.'
  }
  return `UNIT: ${unit}
TOPIC / SECTION: ${topic}

Depth: ${depthMap[opts.depth]}
${opts.terms ? 'Include a Key terms list.' : 'You may skip a separate Key terms list.'}
${opts.summary ? 'Include a Summary / takeaways section at the end.' : ''}
${opts.custom.trim() ? `\nADDITIONAL INSTRUCTIONS FROM THE STUDENT — follow these, they take priority over the defaults above where they conflict:\n${opts.custom.trim()}\n` : ''}
The page title must be copied from the slides themselves (the title/front slide, or the first slide's heading) — not invented or rephrased. Then produce the notes.`
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

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

function toAnthropicContent(blocks: ContentBlock[]): AnthropicContentBlock[] {
  return blocks.map((b) =>
    b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } }
  )
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  stop_reason?: string
  error?: { message?: string }
}

// Non-streaming, unlike the Ollama path — Anthropic's cloud latency is fast enough that this
// never hits the headers-timeout issue that forced Ollama onto streaming, so there's no need
// to force both providers through the same mechanics.
async function generateNotesAnthropic(
  apiKey: string,
  modelId: string,
  contentBlocks: ContentBlock[],
  systemPrompt: string,
  onProgress: (fullText: string) => void
): Promise<string> {
  const messages: Array<{ role: 'user' | 'assistant'; content: AnthropicContentBlock[] | string }> = [
    { role: 'user', content: toAnthropicContent(contentBlocks) }
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
        body: JSON.stringify({ model: modelId, max_tokens: MAX_TOKENS, system: systemPrompt, messages })
      })
    } catch (e) {
      throw new Error(`Couldn't reach Anthropic's API (${(e as Error).message}). Check your internet connection.`)
    }
    if (!resp.ok) {
      // Response body only — never echoes back request headers, so the API key can't leak here.
      const data = (await resp.json().catch(() => ({}))) as AnthropicResponse
      throw new Error(data.error?.message || `Anthropic API ${resp.status}`)
    }
    const data = (await resp.json()) as AnthropicResponse
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

export async function generateNotes(
  config: GenerateConfig,
  contentBlocks: ContentBlock[],
  systemPrompt: string,
  onProgress: (fullText: string) => void
): Promise<string> {
  if (config.provider === 'anthropic') {
    return generateNotesAnthropic(config.apiKey, config.modelId, contentBlocks, systemPrompt, onProgress)
  }
  return generateNotesOllama(config.baseUrl, config.modelId, contentBlocks, systemPrompt, onProgress)
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
