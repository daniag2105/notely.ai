import React, { useRef, useState } from 'react'
import {
  FolderOpen,
  RefreshCw,
  Play,
  Square,
  Check,
  AlertTriangle,
  Loader2,
  X,
  Send
} from 'lucide-react'
import { T } from '../theme'
import { pdfBytesToImages } from '../lib/pdf'
import { publishToNotion, OpenPicker } from '../lib/notionPublish'
import type { ContentBlock, GenerateOptions } from '../App'

type ItemStatus = 'pending' | 'generating' | 'ready' | 'publishing' | 'published' | 'error'

interface BatchItem {
  id: string
  dirPath: string
  slidePath: string
  transcriptPath: string
  topic: string
  included: boolean
  status: ItemStatus
  error?: string
  result?: { title: string; notes: string }
  notionUrl?: string
}

interface Props {
  open: boolean
  onClose: () => void
  units: string[]
  unit: string
  setUnit: (u: string) => void
  options: GenerateOptions
  openPicker: OpenPicker
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function base64ToText(b64: string): string {
  return new TextDecoder('utf-8').decode(base64ToBytes(b64))
}

function extOf(p: string): string {
  const i = p.lastIndexOf('.')
  return i >= 0 ? p.slice(i + 1).toLowerCase() : ''
}

function fileName(p: string): string {
  return p.split(/[/\\]/).pop() || p
}

async function buildContentBlocks(rootPath: string, item: BatchItem): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = []
  const slideExt = extOf(item.slidePath)
  const slideB64 = await window.api.files.readFile(rootPath, item.slidePath)

  if (slideExt === 'pdf') {
    const bytes = base64ToBytes(slideB64)
    const images = await pdfBytesToImages(bytes.buffer as ArrayBuffer)
    for (const data of images) blocks.push({ type: 'image', data, mediaType: 'image/png' })
  } else if (IMAGE_MIME[slideExt]) {
    blocks.push({ type: 'image', data: slideB64, mediaType: IMAGE_MIME[slideExt] })
  } else {
    blocks.push({ type: 'text', text: `LECTURE SLIDES:\n${base64ToText(slideB64)}` })
  }

  const transcriptB64 = await window.api.files.readFile(rootPath, item.transcriptPath)
  blocks.push({
    type: 'text',
    text: `LECTURE TRANSCRIPT (ignore timestamps & filler):\n${base64ToText(transcriptB64)}`
  })

  return blocks
}

function StatusBadge({ status }: { status: ItemStatus }): React.JSX.Element {
  const map: Record<ItemStatus, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: null, label: 'Pending', color: T.faint },
    generating: {
      icon: <Loader2 size={12} className="spin" />,
      label: 'Generating…',
      color: T.blue
    },
    ready: { icon: <Check size={12} />, label: 'Ready', color: T.teal },
    publishing: {
      icon: <Loader2 size={12} className="spin" />,
      label: 'Publishing…',
      color: T.blue
    },
    published: { icon: <Check size={12} />, label: 'Published', color: T.teal },
    error: { icon: <AlertTriangle size={12} />, label: 'Error', color: T.danger }
  }
  const s = map[status]
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: s.color,
        fontSize: 11.5,
        whiteSpace: 'nowrap'
      }}
    >
      {s.icon}
      {s.label}
    </span>
  )
}

export default function BatchModal({
  open,
  onClose,
  units,
  unit,
  setUnit,
  options,
  openPicker
}: Props): React.JSX.Element | null {
  const [rootPath, setRootPath] = useState('')
  const [items, setItems] = useState<BatchItem[]>([])
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [running, setRunning] = useState(false)
  const cancelledRef = useRef(false)

  if (!open) return null

  const updateItem = (id: string, patch: Partial<BatchItem>): void => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const pickFolder = async (): Promise<void> => {
    const picked = await window.api.files.pickFolder()
    if (!picked) return
    setRootPath(picked)
    setScanError('')
    setScanning(true)
    try {
      const result = await window.api.files.scanFolder(picked)
      setItems(
        result.matches.map(
          (
            m: { dirPath: string; slidePath: string; transcriptPath: string; topicGuess: string },
            i: number
          ) => ({
            id: `${i}:${m.slidePath}`,
            dirPath: m.dirPath,
            slidePath: m.slidePath,
            transcriptPath: m.transcriptPath,
            topic: m.topicGuess,
            included: true,
            status: 'pending' as ItemStatus
          })
        )
      )
      setUnmatched(result.unmatched)
    } catch (e) {
      setScanError((e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  const includedCount = items.filter((i) => i.included).length
  const readyCount = items.filter((i) => i.status === 'ready').length
  const publishedCount = items.filter((i) => i.status === 'published').length

  const runGenerate = async (): Promise<void> => {
    cancelledRef.current = false
    setRunning(true)
    try {
      for (const item of items) {
        if (cancelledRef.current) break
        if (!item.included || item.status === 'ready' || item.status === 'published') continue
        updateItem(item.id, { status: 'generating', error: undefined })
        try {
          const blocks = await buildContentBlocks(rootPath, item)
          const raw = (await window.api.notes.generate(
            { unit, topic: item.topic, options, sourceBlocks: blocks, isBatch: true },
            () => {}
          )) as { title: string; notes: string } | { paywall: unknown } | { authRequired: boolean }
          if ('authRequired' in raw) {
            updateItem(item.id, { status: 'error', error: 'Please sign in again.' })
          } else if ('paywall' in raw) {
            updateItem(item.id, { status: 'error', error: 'Batch import requires Notely.ai Pro.' })
          } else {
            updateItem(item.id, { status: 'ready', result: raw })
          }
        } catch (e) {
          updateItem(item.id, { status: 'error', error: (e as Error).message })
        }
      }
    } finally {
      setRunning(false)
    }
  }

  const runPublish = async (): Promise<void> => {
    const configured = await window.api.notion.isConfigured()
    if (!configured) {
      setScanError('Add a Notion integration token in Settings first.')
      return
    }
    cancelledRef.current = false
    setRunning(true)
    try {
      for (const item of items) {
        if (cancelledRef.current) break
        if (item.status !== 'ready' || !item.result) continue
        updateItem(item.id, { status: 'publishing', error: undefined })
        try {
          const r = await publishToNotion(
            { unit, topic: item.topic, title: item.result.title, notes: item.result.notes },
            openPicker
          )
          updateItem(item.id, { status: 'published', notionUrl: r.url })
        } catch (e) {
          updateItem(item.id, { status: 'error', error: (e as Error).message })
        }
      }
    } finally {
      setRunning(false)
    }
  }

  const retryItem = async (id: string): Promise<void> => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (item.result) {
      updateItem(id, { status: 'publishing', error: undefined })
      try {
        const r = await publishToNotion(
          { unit, topic: item.topic, title: item.result.title, notes: item.result.notes },
          openPicker
        )
        updateItem(id, { status: 'published', notionUrl: r.url })
      } catch (e) {
        updateItem(id, { status: 'error', error: (e as Error).message })
      }
    } else {
      updateItem(id, { status: 'generating', error: undefined })
      try {
        const blocks = await buildContentBlocks(rootPath, item)
        const raw = (await window.api.notes.generate(
          { unit, topic: item.topic, options, sourceBlocks: blocks, isBatch: true },
          () => {}
        )) as { title: string; notes: string } | { paywall: unknown } | { authRequired: boolean }
        if ('authRequired' in raw) {
          updateItem(id, { status: 'error', error: 'Please sign in again.' })
        } else if ('paywall' in raw) {
          updateItem(id, { status: 'error', error: 'Batch import requires Notely.ai Pro.' })
        } else {
          updateItem(id, { status: 'ready', result: raw })
        }
      } catch (e) {
        updateItem(id, { status: 'error', error: (e as Error).message })
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50
      }}
      onClick={running ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          background: T.panel,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: `1px solid ${T.lineSoft}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}
        >
          <div>
            <div
              style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: T.text, fontWeight: 600 }}
            >
              Batch import
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 4, lineHeight: 1.5 }}>
              Drop a folder of slide sets + transcripts for one unit and generate a semester&rsquo;s
              notes in one run.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={running}
            style={{
              background: 'none',
              border: 'none',
              cursor: running ? 'default' : 'pointer',
              color: T.faint,
              padding: 4
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={pickFolder}
              disabled={scanning || running}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${T.lineSoft}`,
                background: T.panelHi,
                color: T.text,
                cursor: scanning || running ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5
              }}
            >
              {scanning ? <Loader2 size={14} className="spin" /> : <FolderOpen size={14} />}
              {rootPath ? 'Change folder…' : 'Choose folder…'}
            </button>
            {rootPath && (
              <span
                style={{
                  fontSize: 11.5,
                  color: T.faint,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {rootPath}
              </span>
            )}
          </div>

          {rootPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: T.faint
                }}
              >
                Unit
              </span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={running}
                style={{
                  padding: '6px 8px',
                  borderRadius: 7,
                  background: T.panelHi,
                  border: `1px solid ${T.lineSoft}`,
                  color: T.text,
                  fontSize: 12.5
                }}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scanError && (
            <div style={{ color: T.danger, fontSize: 12.5, lineHeight: 1.5 }}>{scanError}</div>
          )}

          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: T.panelHi,
                    border: `1px solid ${T.lineSoft}`
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.included}
                    disabled={running}
                    onChange={(e) => updateItem(item.id, { included: e.target.checked })}
                  />
                  <input
                    value={item.topic}
                    disabled={running}
                    onChange={(e) => updateItem(item.id, { topic: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: T.bg,
                      border: `1px solid ${T.lineSoft}`,
                      color: T.text,
                      fontSize: 12.5
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: T.faint,
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={`${fileName(item.slidePath)} + ${fileName(item.transcriptPath)}`}
                  >
                    {fileName(item.slidePath)}
                  </span>
                  <StatusBadge status={item.status} />
                  {item.status === 'error' && (
                    <button
                      onClick={() => retryItem(item.id)}
                      disabled={running}
                      title={item.error}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: running ? 'default' : 'pointer',
                        color: T.dim,
                        padding: 2
                      }}
                    >
                      <RefreshCw size={13} />
                    </button>
                  )}
                </div>
              ))}
              {items.some((i) => i.status === 'error') && (
                <div style={{ fontSize: 11, color: T.danger, lineHeight: 1.5 }}>
                  {items
                    .filter((i) => i.status === 'error')
                    .map((i) => `${i.topic}: ${i.error}`)
                    .join(' · ')}
                </div>
              )}
            </div>
          )}

          {unmatched.length > 0 && (
            <div style={{ fontSize: 11.5, color: T.faint, lineHeight: 1.6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: T.dim,
                  marginBottom: 3
                }}
              >
                <AlertTriangle size={12} /> {unmatched.length} file
                {unmatched.length === 1 ? '' : 's'} couldn&rsquo;t be paired (skipped):
              </div>
              {unmatched.map((f) => (
                <div
                  key={f}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {fileName(f)}
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div
            style={{
              padding: 14,
              borderTop: `1px solid ${T.lineSoft}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <span style={{ fontSize: 11.5, color: T.faint, flex: 1 }}>
              {includedCount} queued · {readyCount} ready · {publishedCount} published
            </span>
            {running ? (
              <button
                onClick={() => {
                  cancelledRef.current = true
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: T.danger,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12.5
                }}
              >
                <Square size={13} /> Stop
              </button>
            ) : (
              <>
                <button
                  onClick={runGenerate}
                  disabled={includedCount === 0}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: includedCount === 0 ? T.panelHi : T.blue,
                    color: includedCount === 0 ? T.faint : '#fff',
                    cursor: includedCount === 0 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12.5
                  }}
                >
                  <Play size={13} /> Generate All
                </button>
                <button
                  onClick={runPublish}
                  disabled={readyCount === 0}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: readyCount === 0 ? T.panelHi : T.teal,
                    color: readyCount === 0 ? T.faint : '#1c1417',
                    cursor: readyCount === 0 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 12.5
                  }}
                >
                  <Send size={13} /> Publish All
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
