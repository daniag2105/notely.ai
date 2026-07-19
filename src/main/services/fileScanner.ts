import { promises as fs } from 'fs'
import path from 'path'

export interface ScanMatch {
  dirPath: string
  slidePath: string
  transcriptPath: string
  topicGuess: string
}

export interface ScanResult {
  matches: ScanMatch[]
  unmatched: string[]
}

const SLIDE_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'])
const TRANSCRIPT_EXTS = new Set(['.vtt', '.srt'])
const TEXT_EXTS = new Set(['.txt', '.md'])

const SLIDE_NAME_RE = /slides?/i
const TRANSCRIPT_NAME_RE = /transcripts?|captions?|subtitles?/i

interface ClassifiedFile {
  path: string
  base: string
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

function classify(filePath: string): 'slide' | 'transcript' | null {
  const ext = path.extname(filePath).toLowerCase()
  if (SLIDE_EXTS.has(ext)) return 'slide'
  if (TRANSCRIPT_EXTS.has(ext)) return 'transcript'
  if (TEXT_EXTS.has(ext)) {
    const base = path.basename(filePath, ext)
    if (SLIDE_NAME_RE.test(base)) return 'slide'
    // Loose .txt/.md defaults to transcript — slides are almost always PDFs/images in
    // practice, and this is the more common shape for freeform lecture text exports.
    return 'transcript'
  }
  return null
}

function cleanStem(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath))
  return base
    .replace(new RegExp(SLIDE_NAME_RE, 'gi'), ' ')
    .replace(new RegExp(TRANSCRIPT_NAME_RE, 'gi'), ' ')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function scanFolder(rootPath: string): Promise<ScanResult> {
  const resolvedRoot = path.resolve(rootPath)
  const files = await walk(resolvedRoot)

  const slidesByDir = new Map<string, ClassifiedFile[]>()
  const transcriptsByDir = new Map<string, ClassifiedFile[]>()

  for (const filePath of files) {
    const kind = classify(filePath)
    if (!kind) continue
    const dir = path.dirname(filePath)
    const map = kind === 'slide' ? slidesByDir : transcriptsByDir
    if (!map.has(dir)) map.set(dir, [])
    map.get(dir)!.push({ path: filePath, base: path.basename(filePath) })
  }

  const matches: ScanMatch[] = []
  const unmatched: string[] = []
  const dirs = new Set([...slidesByDir.keys(), ...transcriptsByDir.keys()])

  for (const dir of dirs) {
    const slides = (slidesByDir.get(dir) || []).sort((a, b) => a.base.localeCompare(b.base))
    const transcripts = (transcriptsByDir.get(dir) || []).sort((a, b) => a.base.localeCompare(b.base))

    if (slides.length > 0 && slides.length === transcripts.length) {
      const isRoot = dir === resolvedRoot
      const singlePair = slides.length === 1
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const transcript = transcripts[i]
        let topicGuess: string
        if (singlePair && !isRoot) {
          topicGuess = path.basename(dir)
        } else {
          const slideStem = cleanStem(slide.path)
          const transcriptStem = cleanStem(transcript.path)
          topicGuess = (slideStem.length >= transcriptStem.length ? slideStem : transcriptStem) || path.basename(dir)
        }
        matches.push({ dirPath: dir, slidePath: slide.path, transcriptPath: transcript.path, topicGuess })
      }
    } else {
      for (const f of [...slides, ...transcripts]) unmatched.push(f.path)
    }
  }

  matches.sort((a, b) => a.topicGuess.localeCompare(b.topicGuess))
  unmatched.sort((a, b) => a.localeCompare(b))

  return { matches, unmatched }
}
