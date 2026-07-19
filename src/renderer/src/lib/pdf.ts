import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

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
