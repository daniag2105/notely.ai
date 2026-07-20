import * as pdfjsLib from 'pdfjs-dist'
import { OPS, ImageKind } from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { PDFPageProxy } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

const MAX_PDF_PAGES = 60

export async function pdfBytesToImages(buf: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
  if (pdf.numPages > MAX_PDF_PAGES) {
    console.warn(`PDF has ${pdf.numPages} pages — only the first ${MAX_PDF_PAGES} are sent.`)
  }
  const images: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context to render PDF')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/png').split(',')[1])
  }
  return images
}

export async function pdfToImages(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer()
  return pdfBytesToImages(buf)
}

// ---- Slide figure extraction ----------------------------------------------
// Pulls the discrete raster images the lecturer embedded on each slide out of the PDF at their
// NATIVE resolution (the original asset — no re-render, no crop, no upscale → no blur), so Claude
// can choose the relevant ones and we can embed them inline in Notion. Vector-only diagrams
// (native PowerPoint charts/SmartArt) aren't discrete image objects and are intentionally left to
// the text notes rather than auto-cropped (that's what produces "weird crops").

export interface SlideFigure {
  id: string // "slide.index", e.g. "7.1" — the marker Claude references as figure:7.1
  slide: number
  mediaType: 'image/png'
  dataB64: string // native-resolution PNG, uploaded to Notion
  previewB64: string // downscaled (<=768px) PNG, shown to Claude and in the local preview
}

// Cap figures kept: bounds memory, token cost, and keeps (slides + figures) under Claude's
// per-request image limit even for a full 60-page deck.
const MAX_FIGURES = 24
const MIN_NATIVE_PX = 140 // drop bullets / icons / logos
const FULLPAGE_FRAC = 0.9 // drop slide backgrounds that fill the page
const PREVIEW_MAX_PX = 768

const IMAGE_PAINT_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject
])

// pdf.js Util.transform: compose the current matrix with a `cm` operand.
function mul(m: number[], t: number[]): number[] {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5]
  ]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPageObj(page: PDFPageProxy, name: string, timeoutMs = 4000): Promise<any | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: unknown): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const objs = page.objs as any
      objs.get(name, finish)
    } catch {
      finish(null)
    }
  })
}

// Paint a decoded pdf.js image object onto a canvas at its native pixel size. Returns null for
// kinds we don't render cleanly (1-bpp masks — usually stencils, and their polarity is ambiguous).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imageObjToCanvas(img: any): HTMLCanvasElement | null {
  const w: number = img?.width
  const h: number = img?.height
  if (!w || !h) return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0)
    return canvas
  }
  const src: Uint8ClampedArray | Uint8Array | undefined = img.data
  if (!src) return null

  const out = ctx.createImageData(w, h)
  const dst = out.data
  if (img.kind === ImageKind.RGBA_32BPP) {
    dst.set(src.subarray(0, dst.length))
  } else if (img.kind === ImageKind.RGB_24BPP) {
    for (let i = 0, j = 0; j < dst.length; i += 3, j += 4) {
      dst[j] = src[i]
      dst[j + 1] = src[i + 1]
      dst[j + 2] = src[i + 2]
      dst[j + 3] = 255
    }
  } else {
    return null // GRAYSCALE_1BPP / unknown — skip rather than risk wrong colours
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

function toB64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1]
}

function toPreviewB64(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(canvas.width, canvas.height))
  if (scale >= 1) return toB64(canvas)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(canvas.width * scale))
  c.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = c.getContext('2d')
  if (!ctx) return toB64(canvas)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, c.width, c.height)
  return toB64(c)
}

interface RawFigure {
  slide: number
  yTop: number // page-space y of the image's top edge, for top→bottom ordering
  canvas: HTMLCanvasElement
}

async function extractPageFigures(page: PDFPageProxy, slide: number): Promise<RawFigure[]> {
  const opList = await page.getOperatorList()
  const view = page.view // [x0, y0, x1, y1] in user units
  const pageW = view[2] - view[0]
  const pageH = view[3] - view[1]

  let ctm = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  const seen = new Set<string>()
  const figures: RawFigure[] = []

  for (let k = 0; k < opList.fnArray.length; k++) {
    const fn = opList.fnArray[k]
    const args = opList.argsArray[k]

    if (fn === OPS.save) {
      stack.push(ctm)
      continue
    }
    if (fn === OPS.restore) {
      ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
      continue
    }
    if (fn === OPS.transform) {
      ctm = mul(ctm, args as number[])
      continue
    }
    if (!IMAGE_PAINT_OPS.has(fn)) continue

    // On-page footprint of the unit image square under the current matrix.
    const onW = Math.hypot(ctm[0], ctm[1])
    const onH = Math.hypot(ctm[2], ctm[3])
    if (pageW > 0 && pageH > 0 && onW >= FULLPAGE_FRAC * pageW && onH >= FULLPAGE_FRAC * pageH) {
      continue // slide background, not a figure
    }
    const yTop = ctm[5] + onH // higher = nearer the top of the page

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let imgObj: any = null
    if (fn === OPS.paintInlineImageXObject) {
      imgObj = args[0] // inline image: the object itself
    } else {
      const name = args[0] as string
      if (typeof name !== 'string' || seen.has(name)) continue
      seen.add(name)
      imgObj = await getPageObj(page, name)
    }
    if (!imgObj) continue

    if ((imgObj.width || 0) < MIN_NATIVE_PX || (imgObj.height || 0) < MIN_NATIVE_PX) continue

    try {
      const canvas = imageObjToCanvas(imgObj)
      if (canvas) figures.push({ slide, yTop, canvas })
    } catch {
      // one odd image (unusual colourspace/mask) must never fail the whole run
    }
  }

  figures.sort((a, b) => b.yTop - a.yTop)
  return figures
}

export async function extractSlideFigures(buf: ArrayBuffer): Promise<SlideFigure[]> {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
  const out: SlideFigure[] = []
  // Repeated template art (logos, banners, master-slide decorations) reappears on many slides as
  // byte-identical images. Dedupe globally by the native PNG so they don't crowd out real figures.
  const seenSig = new Set<string>()

  for (let p = 1; p <= pageCount && out.length < MAX_FIGURES; p++) {
    const page = await pdf.getPage(p)
    let raws: RawFigure[]
    try {
      raws = await extractPageFigures(page, p)
    } catch {
      continue // a bad page shouldn't sink figure extraction for the rest
    }
    let k = 0
    for (const raw of raws) {
      if (out.length >= MAX_FIGURES) break
      const dataB64 = toB64(raw.canvas)
      const sig = `${dataB64.length}:${dataB64.slice(0, 64)}`
      if (seenSig.has(sig)) continue
      seenSig.add(sig)
      k++
      out.push({
        id: `${raw.slide}.${k}`,
        slide: raw.slide,
        mediaType: 'image/png',
        dataB64,
        previewB64: toPreviewB64(raw.canvas)
      })
    }
  }
  return out
}
