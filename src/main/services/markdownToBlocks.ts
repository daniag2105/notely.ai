/* eslint-disable @typescript-eslint/no-explicit-any */
// Converts the Notion-flavoured markdown produced by the Claude system prompt
// (see anthropic.ts buildSystemPrompt) into Notion block objects.

type RichText = any
type NotionBlock = any

const MAX_RICH_TEXT = 2000

function chunkText(content: string): string[] {
  if (content.length <= MAX_RICH_TEXT) return [content]
  const parts: string[] = []
  for (let i = 0; i < content.length; i += MAX_RICH_TEXT) {
    parts.push(content.slice(i, i + MAX_RICH_TEXT))
  }
  return parts
}

function pushTextRuns(
  runs: RichText[],
  content: string,
  annotations: Record<string, boolean>
): void {
  if (!content) return
  for (const chunk of chunkText(content)) {
    runs.push({
      type: 'text',
      text: { content: chunk },
      ...(Object.keys(annotations).length ? { annotations } : {})
    })
  }
}

function pushEquationRun(runs: RichText[], expression: string): void {
  const expr = expression.trim()
  if (!expr) return
  // Notion equation rich-text runs have no documented chunking mechanism;
  // extremely long inline expressions (unlikely for lecture math) are passed through as-is.
  runs.push({ type: 'equation', equation: { expression: expr } })
}

// Splits a line of text into Notion rich_text runs, handling `code`, **bold**,
// inline equations (either $...$ or \(...\) — different local models default to
// different LaTeX conventions), and *italic* (in that precedence order, matching
// the original mdToHtml renderer's inline() pass).
export function inlineToRichText(text: string): RichText[] {
  const runs: RichText[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\$([^$]+)\$|\\\((.+?)\\\)|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) pushTextRuns(runs, text.slice(last, m.index), {})
    if (m[1] !== undefined) pushTextRuns(runs, m[1], { code: true })
    else if (m[2] !== undefined) pushTextRuns(runs, m[2], { bold: true })
    else if (m[3] !== undefined) pushEquationRun(runs, m[3])
    else if (m[4] !== undefined) pushEquationRun(runs, m[4])
    else if (m[5] !== undefined) pushTextRuns(runs, m[5], { italic: true })
    last = re.lastIndex
  }
  if (last < text.length) pushTextRuns(runs, text.slice(last), {})
  if (runs.length === 0) pushTextRuns(runs, text, {})
  return runs
}

const CALLOUTS: Record<string, { icon: string; color: string }> = {
  '💡': { icon: '💡', color: 'pink_background' },
  '⚠️': { icon: '⚠️', color: 'orange_background' },
  '📖': { icon: '📖', color: 'gray_background' }
}

const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  md: 'markdown',
  cpp: 'c++',
  cs: 'c#',
  golang: 'go',
  txt: 'plain text',
  text: 'plain text',
  matlab: 'matlab'
}

function mapLanguage(lang: string): string {
  const key = (lang || '').trim().toLowerCase()
  if (!key) return 'plain text'
  return LANGUAGE_MAP[key] || key
}

function block(type: string, body: Record<string, unknown>): NotionBlock {
  return { object: 'block', type, [type]: body }
}

// A standalone image marker the model emits for an extracted slide figure, e.g.
// `![manometer setup](figure:7.1)`. Resolved to a Notion image block backed by an uploaded file.
const FIGURE_MARKER = /^!\[([^\]]*)\]\(figure:([\w.-]+)\)\s*$/

// `figureIdMap` maps a figure id ("7.1") to the Notion file_upload id it was uploaded as. When a
// marker's id isn't in the map (upload failed, or figures weren't sent), the line is dropped
// rather than emitting a broken block.
export function markdownToBlocks(
  markdown: string,
  figureIdMap: Record<string, string> = {}
): NotionBlock[] {
  const lines = (markdown || '').replace(/\r/g, '').split('\n')
  const blocks: NotionBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // extracted slide figure — `![caption](figure:N.k)` on its own line
    const figMatch = line.match(FIGURE_MARKER)
    if (figMatch) {
      const caption = figMatch[1].trim()
      const uploadId = figureIdMap[figMatch[2]]
      if (uploadId) {
        blocks.push(
          block('image', {
            type: 'file_upload',
            file_upload: { id: uploadId },
            caption: caption ? inlineToRichText(caption) : []
          })
        )
      }
      i++
      continue
    }

    // fenced code block
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim()
      let code = ''
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        code += (code ? '\n' : '') + lines[i]
        i++
      }
      i++ // skip closing fence
      const runs: RichText[] = []
      pushTextRuns(runs, code, {})
      blocks.push(block('code', { rich_text: runs, language: mapLanguage(lang) }))
      continue
    }

    // block equation: a line that is solely $$...$$ or \[...\], on one line
    const blockEq = line.trim().match(/^\$\$(.+)\$\$$/) || line.trim().match(/^\\\[(.+)\\\]$/)
    if (blockEq) {
      blocks.push(block('equation', { expression: blockEq[1].trim() }))
      i++
      continue
    }

    // block equation: \[ on its own line, ... expression lines ..., \] on its own line
    // (the delimiter-per-line pattern some local models default to)
    if (line.trim() === '\\[') {
      i++
      const exprLines: string[] = []
      while (i < lines.length && lines[i].trim() !== '\\]') {
        if (lines[i].trim() !== '') exprLines.push(lines[i].trim())
        i++
      }
      i++ // skip closing \]
      blocks.push(block('equation', { expression: exprLines.join(' ').trim() }))
      continue
    }

    // table: header row + separator row
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    ) {
      const rows: string[] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i])
        i++
      }
      const cells = (r: string): string[] =>
        r
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      const tableRow = (cols: string[]): NotionBlock =>
        block('table_row', { cells: cols.map((c) => inlineToRichText(c)) })
      blocks.push(
        block('table', {
          table_width: head.length,
          has_column_header: true,
          has_row_header: false,
          children: [tableRow(head), ...body.map(tableRow)]
        })
      )
      continue
    }

    // bulleted list
    if (/^\s*[-*] /.test(line)) {
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*] /, '')
        blocks.push(block('bulleted_list_item', { rich_text: inlineToRichText(content) }))
        i++
      }
      continue
    }

    // numbered list
    if (/^\s*\d+\. /.test(line)) {
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\. /, '')
        blocks.push(block('numbered_list_item', { rich_text: inlineToRichText(content) }))
        i++
      }
      continue
    }

    // blockquote — callout conventions (Intuition / Watch out / Definition) or plain quote
    if (/^> /.test(line)) {
      const content = line.replace(/^> /, '')
      const emojiMatch = content.match(/^(💡|⚠️|📖)\s*/)
      if (emojiMatch) {
        const callout = CALLOUTS[emojiMatch[1]]
        const rest = content.slice(emojiMatch[0].length)
        blocks.push(
          block('callout', {
            rich_text: inlineToRichText(rest),
            icon: { type: 'emoji', emoji: callout.icon },
            color: callout.color
          })
        )
      } else {
        blocks.push(block('quote', { rich_text: inlineToRichText(content) }))
      }
      i++
      continue
    }

    // headings — lenient: 1+ leading hashes (some models skip the space after the
    // hashes, or nest deeper than Notion's 3 levels), clamped to heading_3, with any
    // ATX-style trailing hashes stripped ("## Heading ##" -> "Heading"). A strict
    // "exactly 1-3 hashes + one space" match used to let anything else (missing space,
    // 4+ hashes) fall through as literal "####..." paragraph text.
    const headingMatch = line.match(/^(#{1,})\s*(.*)$/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3)
      const text = headingMatch[2].replace(/\s*#+\s*$/, '').trim()
      const type = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3'
      blocks.push(block(type, { rich_text: inlineToRichText(text) }))
      i++
      continue
    }

    // divider
    if (/^---\s*$/.test(line)) {
      blocks.push(block('divider', {}))
      i++
      continue
    }

    // blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // paragraph (default)
    blocks.push(block('paragraph', { rich_text: inlineToRichText(line) }))
    i++
  }

  return blocks
}

// Splits a flat block array into chunks Notion will accept in a single
// blocks.children.append (or the initial pages.create children array) call.
export function chunkBlocks(blocks: NotionBlock[], size = 100): NotionBlock[][] {
  const chunks: NotionBlock[][] = []
  for (let i = 0; i < blocks.length; i += size) {
    chunks.push(blocks.slice(i, i + size))
  }
  return chunks
}
