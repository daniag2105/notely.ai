import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Upload,
  Sparkles,
  Copy,
  Download,
  Check,
  X,
  Plus,
  ChevronRight,
  AlertTriangle,
  Loader2,
  ClipboardList,
  FolderOpen,
  Settings as SettingsIcon,
  ExternalLink,
  Send,
  LogIn,
  Lock,
  Sun,
  Moon
} from 'lucide-react'
import { T } from './theme'
import { useThemeMode } from './lib/theme-mode'
import { mdToHtml } from './lib/mdToHtml'
import { pdfToImages, extractSlideFigures, SlideFigure } from './lib/pdf'
import { publishToNotion, PublishFigure } from './lib/notionPublish'
import SettingsModal from './components/SettingsModal'
import NotionPagePicker, { PickerPage } from './components/NotionPagePicker'
import BatchModal from './components/BatchModal'
import AuthModal from './components/AuthModal'
import PaywallModal from './components/PaywallModal'

export type ContentBlock =
  { type: 'text'; text: string } | { type: 'image'; data: string; mediaType: string }

export type Depth = 'concise' | 'standard' | 'detailed'
export type OutputMode = 'notes' | 'math' | 'examples'

export interface GenerateOptions {
  depth: Depth
  mode: OutputMode
  custom: string
}

// Mirrors the backend's account summary (window.api.auth.me()). `unlocked` are UX hints for
// enabling/disabling controls — the server independently enforces every one of them.
export interface AccountSummary {
  email: string
  plan: 'free' | 'pro'
  jotsBalance: number
  freeNotesUsed: number
  freeFiguresUsed: number
  limits: { freeNotes: number; freeFigures: number }
  unlocked: {
    detailed: boolean
    custom: boolean
    opus: boolean
    batch: boolean
    figures: boolean
    notes: boolean
  }
}

export interface PaywallInfo {
  code: 'pro_required' | 'quota_exhausted' | 'figures_exhausted'
  reasons: string[]
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(new Error('Could not read file'))
    r.readAsDataURL(file)
  })

const readText = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error('Could not read file'))
    r.readAsText(file)
  })

function progressTail(full: string): string {
  const idx = full.indexOf('===NOTES===')
  const notes = idx >= 0 ? full.slice(idx + '===NOTES==='.length) : full
  return notes.trim().slice(-600)
}

// ---- UI atoms --------------------------------------------------------------
function Chip({
  label,
  value,
  color,
  bg,
  active
}: {
  label: string
  value: string
  color: string
  bg: string
  active: boolean
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        padding: '8px 12px',
        borderRadius: 9,
        flex: 1,
        background: active ? bg : T.panelHi,
        border: `1px solid ${active ? color : T.lineSoft}`,
        opacity: active ? 1 : 0.6,
        transition: 'all .2s'
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: active ? color : T.faint
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: active ? T.text : T.faint,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {value || '—'}
      </span>
    </div>
  )
}

function SourceInput({
  title,
  accept,
  mode,
  setMode,
  text,
  setText,
  file,
  setFile,
  placeholder,
  hint,
  color
}: {
  title: string
  accept: string
  mode: string
  setMode: (m: string) => void
  text: string
  setText: (t: string) => void
  file: File | null
  setFile: (f: File | null) => void
  placeholder: string
  hint: string
  color: string
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8
        }}
      >
        <label
          style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'Georgia, serif' }}
        >
          {title}
        </label>
        <div
          style={{
            display: 'flex',
            background: T.panelHi,
            borderRadius: 7,
            padding: 2,
            border: `1px solid ${T.lineSoft}`
          }}
        >
          {['upload', 'paste'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                background: mode === m ? color : 'transparent',
                color: mode === m ? '#fff' : T.dim,
                textTransform: 'capitalize',
                fontWeight: 600
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === 'upload' ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 9,
              cursor: 'pointer',
              border: `1px dashed ${file ? color : T.line}`,
              background: file ? `color-mix(in srgb, ${color} 8%, transparent)` : T.panelHi,
              color: file ? T.text : T.dim,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: 'center'
            }}
          >
            {file ? <FileText size={16} /> : <Upload size={16} />}
            <span
              style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {file ? file.name : 'Choose file'}
            </span>
            {file && (
              <X
                size={14}
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
                style={{ opacity: 0.7 }}
              />
            )}
          </button>
          <p style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>{hint}</p>
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: 96,
            resize: 'vertical',
            padding: 11,
            borderRadius: 9,
            background: T.panelHi,
            border: `1px solid ${T.lineSoft}`,
            color: T.text,
            fontSize: 12.5,
            lineHeight: 1.5,
            fontFamily: 'ui-monospace, Menlo, monospace',
            outline: 'none'
          }}
        />
      )}
    </div>
  )
}

export interface PickerState {
  heading: string
  subheading?: string
  initialQuery: string
  fetchResults: (query: string) => Promise<PickerPage[]>
  createLabel?: string
  onCreateNew?: () => Promise<PickerPage>
  resolve: (p: PickerPage) => void
  reject: (e: Error) => void
}

// ---- main ------------------------------------------------------------------
export default function App(): React.JSX.Element {
  const [units, setUnits] = useState(['ENSC3004'])
  const [unit, setUnit] = useState('ENSC3004')
  const [unitsLoaded, setUnitsLoaded] = useState(false)
  const [addingUnit, setAddingUnit] = useState(false)
  const [newUnit, setNewUnit] = useState('')
  const [topic, setTopic] = useState('')

  useEffect(() => {
    window.api.settings.getUnits().then((saved: string[]) => {
      if (saved && saved.length) {
        setUnits(saved)
        setUnit(saved[0])
      }
      setUnitsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (unitsLoaded) window.api.settings.setUnits(units)
  }, [units, unitsLoaded])

  // The signed-in Notely account — plan, Jots, free-tier usage, and the `unlocked` flags that gate
  // features. Null until checked, or when signed out (then we prompt sign-in). Generation is a
  // metered server call now, so there's no local API key to set up.
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [paywall, setPaywall] = useState<PaywallInfo | null>(null)

  const refreshAccount = async (): Promise<AccountSummary | null> => {
    const a = (await window.api.auth.me()) as AccountSummary | null
    setAccount(a)
    setAccountLoaded(true)
    return a
  }

  useEffect(() => {
    refreshAccount().then((a) => {
      if (!a) setAuthOpen(true)
      // Pull this account's Notion connection into the local cache (it lives on the account now,
      // not the device), so the Settings "Connected" state and Send-to-Notion reflect who's signed in.
      else window.api.notion.sync()
    })
  }, [])

  // Returns true if the current account may use a Pro-gated feature; otherwise shows the paywall
  // (or the sign-in modal) and returns false. Used by the detailed/custom/batch/figures controls.
  const requireUnlocked = (feature: keyof AccountSummary['unlocked'], reason: string): boolean => {
    if (!account) {
      setAuthOpen(true)
      return false
    }
    if (account.unlocked[feature]) return true
    setPaywall({
      code: feature === 'figures' ? 'figures_exhausted' : 'pro_required',
      reasons: [reason]
    })
    return false
  }

  const customLocked = !!account && !account.unlocked.custom

  const [slideMode, setSlideMode] = useState('upload')
  const [slideText, setSlideText] = useState('')
  const [slideFile, setSlideFile] = useState<File | null>(null)
  // Figures extracted from the current PDF (native-res bytes + a small preview each), kept so we
  // can embed the ones Claude references when publishing to Notion.
  const [slideFigures, setSlideFigures] = useState<SlideFigure[]>([])

  const [txMode, setTxMode] = useState('paste')
  const [txText, setTxText] = useState('')
  const [txFile, setTxFile] = useState<File | null>(null)

  const [mode, setMode] = useState<OutputMode>('notes')
  const [depth, setDepth] = useState<Depth>('standard')
  const [addFigures, setAddFigures] = useState(true)
  const [customInstructions, setCustomInstructions] = useState('')

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [out, setOut] = useState<{ title: string; notes: string; verified?: boolean } | null>(null)
  const [tab, setTab] = useState('markdown')
  const [copied, setCopied] = useState('')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const { resolved: theme, setMode: setTheme } = useThemeMode()
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [notionBusy, setNotionBusy] = useState(false)
  const [notionError, setNotionError] = useState('')
  const [notionUrl, setNotionUrl] = useState('')

  const hasSlides = slideMode === 'upload' ? !!slideFile : slideText.trim().length > 0
  const hasTx = txMode === 'upload' ? !!txFile : txText.trim().length > 0
  const ready = unit && topic.trim() && (hasSlides || hasTx)

  // Data-URI previews of extracted figures, keyed by figure id, so the Preview tab can render the
  // `![caption](figure:N.k)` markers inline before publishing.
  const figurePreviewMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of slideFigures) map[f.id] = `data:${f.mediaType};base64,${f.previewB64}`
    return map
  }, [slideFigures])

  const previewHtml = useMemo(
    () => (out ? mdToHtml(out.notes, figurePreviewMap) : ''),
    [out, figurePreviewMap]
  )

  const removeUnit = (u: string): void => {
    setUnits((prev) => {
      const next = prev.filter((x) => x !== u)
      if (unit === u) setUnit(next[0] || '')
      return next
    })
  }

  const copy = async (text: string, key: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta)
    }
    setCopied(key)
    setTimeout(() => setCopied(''), 1600)
  }

  const download = (): void => {
    if (!out) return
    const blob = new Blob([out.notes], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (out.title || 'notes')
      .replace(/[^\w\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    a.href = url
    a.download = `${unit}-${safe}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const run = async (): Promise<void> => {
    if (!account) {
      setAuthOpen(true)
      return
    }
    setError('')
    setOut(null)
    setProgress('')
    setNotionUrl('')
    setNotionError('')
    setSlideFigures([])
    setLoading(true)
    try {
      const content: ContentBlock[] = []
      let figures: SlideFigure[] = []

      if (slideMode === 'upload' && slideFile) {
        if (slideFile.type === 'application/pdf') {
          const images = await pdfToImages(slideFile)
          for (const data of images) content.push({ type: 'image', data, mediaType: 'image/png' })
          if (addFigures) {
            try {
              // Read a fresh buffer — pdf.js detaches the one it parses, so we can't reuse it.
              figures = await extractSlideFigures(await slideFile.arrayBuffer())
              setSlideFigures(figures)
              for (const f of figures) {
                content.push({ type: 'text', text: `Figure ${f.id}:` })
                content.push({ type: 'image', data: f.previewB64, mediaType: f.mediaType })
              }
            } catch (e) {
              console.warn('Slide figure extraction failed', e)
            }
          }
        } else if (slideFile.type.startsWith('image/')) {
          const b64 = await fileToBase64(slideFile)
          content.push({ type: 'image', data: b64, mediaType: slideFile.type })
        } else {
          const t = await readText(slideFile)
          content.push({ type: 'text', text: `LECTURE SLIDES:\n${t}` })
        }
      } else if (slideText.trim()) {
        content.push({ type: 'text', text: `LECTURE SLIDES:\n${slideText}` })
      }

      let transcript = txText
      if (txMode === 'upload' && txFile) transcript = await readText(txFile)
      if (transcript.trim()) {
        content.push({
          type: 'text',
          text: `LECTURE TRANSCRIPT (ignore timestamps & filler):\n${transcript}`
        })
      }

      const result = (await window.api.notes.generate(
        {
          unit,
          topic,
          options: { depth, mode, custom: customInstructions },
          sourceBlocks: content,
          hasFigures: figures.length > 0
        },
        (partial: string) => setProgress(progressTail(partial))
      )) as
        | { title: string; notes: string; verified?: boolean }
        | { paywall: PaywallInfo }
        | { authRequired: true }

      if ('authRequired' in result) {
        setAuthOpen(true)
        return
      }
      if ('paywall' in result) {
        setPaywall(result.paywall)
        return
      }
      setOut(result)
      setTab('markdown')
      // Refresh so the "free notes left" / Jots count in the header reflects this generation.
      refreshAccount()
    } catch (e) {
      setError((e as Error).message || 'Something went wrong generating the notes.')
    } finally {
      setLoading(false)
    }
  }

  const openPicker = (cfg: Omit<PickerState, 'resolve' | 'reject'>): Promise<PickerPage> =>
    new Promise((resolve, reject) => {
      setPicker({ ...cfg, resolve, reject })
    })

  const sendToNotion = async (): Promise<void> => {
    if (!out) return
    setNotionBusy(true)
    setNotionError('')
    setNotionUrl('')
    try {
      const configured = await window.api.notion.isConfigured()
      if (!configured) {
        setSettingsOpen(true)
        throw new Error('Add a Notion integration token in Settings first.')
      }

      // Only upload figures the notes actually reference, at native resolution.
      const referenced = new Set<string>()
      for (const m of out.notes.matchAll(/figure:([\w.-]+)/g)) referenced.add(m[1])
      const figures: PublishFigure[] = slideFigures
        .filter((f) => referenced.has(f.id))
        .map((f) => ({ id: f.id, dataB64: f.dataB64, mediaType: f.mediaType }))

      const result = await publishToNotion(
        { unit, topic, title: out.title, notes: out.notes, figures },
        openPicker
      )
      setNotionUrl(result.url)
    } catch (e) {
      setNotionError((e as Error).message)
    } finally {
      setNotionBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: T.bg,
        color: T.text,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .l2n-grid { display: grid; grid-template-columns: minmax(0,420px) minmax(0,1fr); gap: 20px; }
        @media (max-width: 820px){ .l2n-grid { grid-template-columns: 1fr; } }
        input:focus, textarea:focus, select:focus { outline: none; border-color: ${T.blue} !important; }
        .prev{ font-family: Georgia, 'Times New Roman', Times, serif; }
        .prev h1{ font-family: Georgia, serif; font-size: 22px; margin: 18px 0 8px; color:${T.text}; }
        .prev h2{ font-family: Georgia, serif; font-size: 18px; margin: 16px 0 6px; color:${T.text}; }
        .prev h3{ font-family: Georgia, serif; font-size: 15px; margin: 12px 0 4px; color:${T.dim}; }
        .prev p{ margin: 6px 0; line-height: 1.6; color:${T.text}; font-size: 14px; }
        .prev ul,.prev ol{ margin: 6px 0 6px 20px; line-height: 1.6; font-size: 14px; }
        .prev li{ margin: 2px 0; }
        .prev blockquote{ border-left: 3px solid ${T.amber}; background:${T.panelHi}; margin: 8px 0; padding: 8px 12px; border-radius: 0 8px 8px 0; font-size: 14px; }
        .prev hr{ border: none; border-top: 1px solid ${T.line}; margin: 16px 0; }
        .prev code.ic{ background:${T.panelHi}; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
        .prev pre.cb{ background:${T.codeBg}; border:1px solid ${T.line}; padding: 12px; border-radius: 8px; overflow:auto; font-size: 12.5px; }
        .prev .eq{ background:${T.blueBg}; color:${T.text}; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12.5px; }
        .prev table.tb{ border-collapse: collapse; margin: 10px 0; width: 100%; font-size: 13px; }
        .prev table.tb th, .prev table.tb td{ border: 1px solid ${T.line}; padding: 6px 10px; text-align: left; }
        .prev table.tb th{ background:${T.panelHi}; }
        .prev figure.slidefig{ margin: 12px 0; }
        .prev figure.slidefig img{ display:block; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${T.line}; }
        .prev figure.slidefig figcaption{ font-size: 12px; color:${T.dim}; margin-top: 5px; font-style: italic; }
        .prev .slidefig-ph{ margin: 12px 0; padding: 10px 12px; border: 1px dashed ${T.line}; border-radius: 8px; color:${T.faint}; font-size: 12.5px; }
        .spin{ animation: sp 1s linear infinite; } @keyframes sp{ to{ transform: rotate(360deg); } }
        .genbtn:hover:not(:disabled){ filter: brightness(1.08); }
        button:focus-visible{ outline: 2px solid ${T.blue}; outline-offset: 2px; }
      `}</style>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 20px 60px' }}>
        {/* header */}
        <div
          style={{
            marginBottom: 22,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: T.blueBg,
                  border: `1px solid ${T.blue}`,
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <ClipboardList size={18} color={T.blue} />
              </div>
              <h1
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 24,
                  margin: 0,
                  letterSpacing: '-.01em'
                }}
              >
                Notely.ai
              </h1>
            </div>
            <p
              style={{
                color: T.dim,
                fontSize: 13.5,
                margin: '8px 0 0',
                maxWidth: 640,
                lineHeight: 1.5
              }}
            >
              Drop a slide deck and paste the lecture transcript. Get clean, Notion-ready notes,
              routed straight to the right unit and topic.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle light and dark mode"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`,
                background: T.panel,
                color: T.dim,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {account && (
              <button
                onClick={() => setSettingsOpen(true)}
                title={account.email}
                style={{
                  padding: '8px 11px',
                  borderRadius: 9,
                  border: `1px solid ${account.plan === 'pro' ? T.blue : T.lineSoft}`,
                  background: account.plan === 'pro' ? T.blueBg : T.panel,
                  color: account.plan === 'pro' ? T.blue : T.dim,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {account.plan === 'pro' ? (
                  <>
                    <Sparkles size={13} /> Pro
                  </>
                ) : (
                  <>
                    {Math.max(account.limits.freeNotes - account.freeNotesUsed, 0)} free left
                    {account.jotsBalance > 0 ? ` · ${account.jotsBalance} Jots` : ''}
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => {
                if (requireUnlocked('batch', 'batch')) setBatchOpen(true)
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`,
                background: T.panel,
                color: T.dim,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5
              }}
            >
              <FolderOpen size={15} /> Batch import
              {account && !account.unlocked.batch && <Lock size={12} style={{ marginLeft: 2 }} />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`,
                background: T.panel,
                color: T.dim,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12.5
              }}
            >
              <SettingsIcon size={15} /> Settings
            </button>
          </div>
        </div>

        {accountLoaded && !account && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: T.blueBg,
              border: `1px solid ${T.blue}`,
              borderRadius: 12,
              padding: '13px 15px',
              marginBottom: 18
            }}
          >
            <LogIn size={18} color={T.blue} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
              <b>Sign in to start:</b> create a free Notely.ai account — your first 5 notes are on
              us.
            </div>
            <button
              onClick={() => setAuthOpen(true)}
              style={{
                padding: '9px 14px',
                borderRadius: 9,
                border: 'none',
                background: T.blue,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              Sign in
            </button>
          </div>
        )}

        <div className="l2n-grid">
          {/* ---------------- LEFT: inputs ---------------- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* destination rail */}
            <div
              style={{
                background: T.panel,
                border: `1px solid ${T.line}`,
                borderRadius: 13,
                padding: 15
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: T.faint
                  }}
                >
                  Destination
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Chip label="Unit" value={unit} color={T.blue} bg={T.blueBg} active={!!unit} />
                <ChevronRight size={16} color={T.faint} style={{ flexShrink: 0 }} />
                <Chip
                  label="Topic"
                  value={topic}
                  color={T.teal}
                  bg={T.tealBg}
                  active={!!topic.trim()}
                />
                <ChevronRight size={16} color={T.faint} style={{ flexShrink: 0 }} />
                <Chip
                  label="Page"
                  value={out ? out.title : 'on generate'}
                  color={T.purple}
                  bg={T.purpleBg}
                  active={!!out}
                />
              </div>

              {/* unit picker */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {units.map((u) => (
                    <span
                      key={u}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 7px 5px 11px',
                        borderRadius: 7,
                        fontSize: 12.5,
                        fontWeight: 600,
                        border: `1px solid ${unit === u ? T.blue : T.lineSoft}`,
                        background: unit === u ? T.blueBg : T.panelHi,
                        color: unit === u ? T.text : T.dim
                      }}
                    >
                      <button
                        onClick={() => setUnit(u)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'inherit',
                          font: 'inherit'
                        }}
                      >
                        {u}
                      </button>
                      <X
                        size={12}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeUnit(u)
                        }}
                        style={{ opacity: 0.6, cursor: 'pointer' }}
                      />
                    </span>
                  ))}
                  {addingUnit ? (
                    <span style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        autoFocus
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newUnit.trim()) {
                            setUnits([...new Set([...units, newUnit.trim()])])
                            setUnit(newUnit.trim())
                            setNewUnit('')
                            setAddingUnit(false)
                          } else if (e.key === 'Escape') {
                            setAddingUnit(false)
                            setNewUnit('')
                          }
                        }}
                        placeholder="ENSC3205"
                        style={{
                          width: 90,
                          padding: '5px 8px',
                          borderRadius: 7,
                          background: T.panelHi,
                          border: `1px solid ${T.line}`,
                          color: T.text,
                          fontSize: 12.5
                        }}
                      />
                    </span>
                  ) : (
                    <button
                      onClick={() => setAddingUnit(true)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 7,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        border: `1px dashed ${T.line}`,
                        background: 'transparent',
                        color: T.dim,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                    >
                      <Plus size={13} /> unit
                    </button>
                  )}
                </div>
              </div>

              {/* topic */}
              <div style={{ marginTop: 12 }}>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Topic — e.g. Topic 3: Fluid Statics"
                  style={{
                    width: '100%',
                    padding: '9px 11px',
                    borderRadius: 8,
                    background: T.panelHi,
                    border: `1px solid ${T.lineSoft}`,
                    color: T.text,
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            {/* sources */}
            <div
              style={{
                background: T.panel,
                border: `1px solid ${T.line}`,
                borderRadius: 13,
                padding: 15,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <SourceInput
                title="Lecture slides"
                accept=".pdf,image/*,.txt,.md"
                mode={slideMode}
                setMode={setSlideMode}
                text={slideText}
                setText={setSlideText}
                file={slideFile}
                setFile={setSlideFile}
                placeholder="Paste slide text…"
                hint="PDF, image, or text. PDFs are read directly."
                color={T.teal}
              />
              <div style={{ height: 1, background: T.lineSoft }} />
              <SourceInput
                title="Lecture transcript"
                accept=".txt,.md,.vtt,.srt"
                mode={txMode}
                setMode={setTxMode}
                text={txText}
                setText={setTxText}
                file={txFile}
                setFile={setTxFile}
                placeholder="Paste the transcript (.vtt/.srt fine — timestamps ignored)…"
                hint="Text, .vtt or .srt. This is where the intuition comes from."
                color={T.amber}
              />
            </div>

            {/* options */}
            <div
              style={{
                background: T.panel,
                border: `1px solid ${T.line}`,
                borderRadius: 13,
                padding: 15
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: T.faint
                }}
              >
                Options
              </span>
              {/* output mode */}
              <div
                style={{
                  display: 'flex',
                  gap: 5,
                  marginTop: 10,
                  background: T.panelHi,
                  padding: 3,
                  borderRadius: 9,
                  border: `1px solid ${T.lineSoft}`
                }}
              >
                {(
                  [
                    ['notes', 'Notes'],
                    ['math', 'Math'],
                    ['examples', 'Examples']
                  ] as [OutputMode, string][]
                ).map(([m, lbl]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: 'none',
                      fontWeight: 600,
                      background: mode === m ? T.blue : 'transparent',
                      color: mode === m ? '#fff' : T.dim
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: T.faint, margin: '8px 0 0', lineHeight: 1.5 }}>
                {mode === 'notes'
                  ? 'Full study notes from the slides + transcript.'
                  : mode === 'math'
                    ? 'A clean sheet of every formula, constant & key quantity — nothing else.'
                    : 'Only the lecture’s worked examples, solved step by step.'}
              </p>

              {/* depth — notes only */}
              {mode === 'notes' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 5,
                    marginTop: 12,
                    background: T.panelHi,
                    padding: 3,
                    borderRadius: 9,
                    border: `1px solid ${T.lineSoft}`
                  }}
                >
                  {(['concise', 'standard', 'detailed'] as Depth[]).map((d) => {
                    const locked = d === 'detailed' && !!account && !account.unlocked.detailed
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          if (d === 'detailed') {
                            if (requireUnlocked('detailed', 'detailed')) setDepth('detailed')
                          } else {
                            setDepth(d)
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: 6,
                          fontSize: 12,
                          cursor: 'pointer',
                          border: 'none',
                          textTransform: 'capitalize',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          background: depth === d ? T.blue : 'transparent',
                          color: depth === d ? '#fff' : T.dim
                        }}
                      >
                        {d}
                        {locked && <Lock size={11} />}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {(
                  [['Slide figures', addFigures, setAddFigures]] as [
                    string,
                    boolean,
                    (v: boolean) => void
                  ][]
                ).map(([lbl, val, set]) => (
                  <label
                    key={lbl}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12.5,
                      color: T.dim,
                      cursor: 'pointer'
                    }}
                  >
                    <span
                      onClick={() => {
                        if (!val) {
                          if (requireUnlocked('figures', 'figures')) set(true)
                        } else {
                          set(false)
                        }
                      }}
                      style={{
                        width: 34,
                        height: 19,
                        borderRadius: 10,
                        padding: 2,
                        cursor: 'pointer',
                        transition: 'background .15s',
                        background: val ? T.teal : T.lineSoft,
                        display: 'inline-flex'
                      }}
                    >
                      <span
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.28)',
                          transform: val ? 'translateX(15px)' : 'none',
                          transition: 'transform .15s'
                        }}
                      />
                    </span>
                    {lbl}
                    {account && !account.unlocked.figures && <Lock size={11} />}
                  </label>
                ))}
              </div>
              {account && account.plan !== 'pro' && (
                <p
                  style={{
                    fontSize: 11,
                    color: T.amber,
                    margin: '9px 0 0',
                    lineHeight: 1.5,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start'
                  }}
                >
                  <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                  {account.freeFiguresUsed < account.limits.freeFigures
                    ? `You get ${account.limits.freeFigures} free slide-figure extraction — use it wisely.`
                    : 'Free slide-figure extraction used — Pro only from here.'}
                </p>
              )}
              {addFigures && (
                <p style={{ fontSize: 11, color: T.faint, margin: '9px 0 0', lineHeight: 1.5 }}>
                  Pulls diagrams &amp; photos out of PDF slides and embeds the relevant ones inline
                  when you Send to Notion (they don&rsquo;t copy into the markdown).
                </p>
              )}
              <div style={{ marginTop: 14 }}>
                <label
                  style={{
                    fontSize: 11,
                    letterSpacing: '.04em',
                    color: T.faint,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 6
                  }}
                >
                  Custom instructions
                  {customLocked && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        color: T.blue,
                        fontWeight: 600
                      }}
                    >
                      <Lock size={10} /> Pro
                    </span>
                  )}
                </label>
                <textarea
                  value={customLocked ? '' : customInstructions}
                  readOnly={customLocked}
                  onMouseDown={(e) => {
                    if (customLocked) {
                      e.preventDefault()
                      requireUnlocked('custom', 'custom')
                    }
                  }}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={
                    customLocked
                      ? 'Custom instructions are a Pro feature — upgrade to tailor how notes are written.'
                      : 'Anything specific you want emphasized, skipped, or handled differently — e.g. "focus more on the derivation, skip the worked example"…'
                  }
                  style={{
                    width: '100%',
                    minHeight: 64,
                    resize: 'vertical',
                    padding: 9,
                    borderRadius: 8,
                    background: T.panelHi,
                    border: `1px solid ${T.lineSoft}`,
                    color: T.text,
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    outline: 'none',
                    opacity: customLocked ? 0.6 : 1,
                    cursor: customLocked ? 'pointer' : 'text'
                  }}
                />
              </div>
            </div>

            <button
              className="genbtn"
              disabled={!ready || loading}
              onClick={run}
              style={{
                padding: '13px',
                borderRadius: 11,
                border: 'none',
                cursor: ready && !loading ? 'pointer' : 'not-allowed',
                background: ready && !loading ? T.blue : T.lineSoft,
                color: ready && !loading ? '#fff' : T.faint,
                fontSize: 14.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9
              }}
            >
              {loading ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
              {loading ? 'Generating notes…' : 'Generate notes'}
            </button>
            {!ready && !loading && (
              <p
                style={{ fontSize: 11.5, color: T.faint, textAlign: 'center', margin: '-6px 0 0' }}
              >
                Pick a unit, name the topic, and add slides or a transcript.
              </p>
            )}
          </div>

          {/* ---------------- RIGHT: output ---------------- */}
          <div
            style={{
              background: T.panel,
              border: `1px solid ${T.line}`,
              borderRadius: 13,
              minHeight: 460,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {error && (
              <div
                style={{
                  margin: 15,
                  padding: 12,
                  borderRadius: 9,
                  background: `color-mix(in srgb, ${T.danger} 10%, transparent)`,
                  border: `1px solid ${T.danger}`,
                  display: 'flex',
                  gap: 9,
                  alignItems: 'flex-start'
                }}
              >
                <AlertTriangle size={16} color={T.danger} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {!out && !loading && !error && (
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 30,
                  textAlign: 'center'
                }}
              >
                <div style={{ maxWidth: 360 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      background: T.panelHi,
                      border: `1px solid ${T.line}`,
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 14px'
                    }}
                  >
                    <FileText size={22} color={T.faint} />
                  </div>
                  <p style={{ color: T.dim, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    Your Notion-ready notes will appear here. The page title and body come out
                    separately so you can drop them straight into the right topic page — or send
                    them to Notion directly.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    color: T.dim,
                    fontSize: 13,
                    marginBottom: 12
                  }}
                >
                  <Loader2 size={15} className="spin" /> Reading sources & writing notes…
                </div>
                <pre
                  style={{
                    flex: 1,
                    margin: 0,
                    padding: 12,
                    borderRadius: 9,
                    background: T.codeBg,
                    border: `1px solid ${T.lineSoft}`,
                    color: T.dim,
                    fontSize: 12,
                    lineHeight: 1.55,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {progress || '…'}
                </pre>
              </div>
            )}

            {out && !loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* destination + title bar */}
                <div style={{ padding: '14px 15px', borderBottom: `1px solid ${T.lineSoft}` }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: T.dim,
                      marginBottom: 9,
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: T.blueBg,
                        color: T.blue,
                        fontWeight: 600
                      }}
                    >
                      {unit}
                    </span>
                    <ChevronRight size={13} />
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: T.tealBg,
                        color: T.teal,
                        fontWeight: 600
                      }}
                    >
                      {topic}
                    </span>
                    <ChevronRight size={13} />
                    <span style={{ color: T.faint }}>new sub-page →</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '8px 11px',
                        borderRadius: 8,
                        background: T.panelHi,
                        border: `1px solid ${T.lineSoft}`
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9.5,
                            letterSpacing: '.08em',
                            textTransform: 'uppercase',
                            color: T.faint
                          }}
                        >
                          Page title
                        </span>
                        {out.verified && (
                          <span
                            title="Re-checked against your slides & transcript for accuracy"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 9.5,
                              letterSpacing: '.04em',
                              textTransform: 'uppercase',
                              color: T.teal,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Check size={11} /> Accuracy-checked
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: 'Georgia, serif',
                          color: T.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {out.title}
                      </div>
                    </div>
                    <button
                      onClick={() => copy(out.title, 'title')}
                      style={{
                        padding: '9px 11px',
                        borderRadius: 8,
                        border: `1px solid ${T.lineSoft}`,
                        background: T.panelHi,
                        color: T.dim,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12
                      }}
                    >
                      {copied === 'title' ? <Check size={14} color={T.teal} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* tabs + actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 15px',
                    borderBottom: `1px solid ${T.lineSoft}`,
                    flexWrap: 'wrap',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['markdown', 'preview'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                          fontSize: 12.5,
                          padding: '5px 12px',
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          fontWeight: 600,
                          background: tab === t ? T.panelHi : 'transparent',
                          color: tab === t ? T.text : T.faint
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => copy(out.notes, 'notes')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        background: T.blue,
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {copied === 'notes' ? <Check size={14} /> : <Copy size={14} />}{' '}
                      {copied === 'notes' ? 'Copied' : 'Copy markdown'}
                    </button>
                    <button
                      onClick={download}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: `1px solid ${T.lineSoft}`,
                        background: T.panelHi,
                        color: T.dim,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12.5
                      }}
                    >
                      <Download size={14} /> .md
                    </button>
                    <button
                      onClick={sendToNotion}
                      disabled={notionBusy}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `1px solid ${T.purple}`,
                        background: T.purpleBg,
                        color: T.purple,
                        cursor: notionBusy ? 'default' : 'pointer',
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {notionBusy ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                      {notionBusy ? 'Sending…' : 'Send to Notion'}
                    </button>
                  </div>
                </div>

                {(notionUrl || notionError) && (
                  <div
                    style={{
                      padding: '9px 15px',
                      borderBottom: `1px solid ${T.lineSoft}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    {notionUrl ? (
                      <a
                        href={notionUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 12.5,
                          color: T.purple,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          textDecoration: 'none'
                        }}
                      >
                        <Check size={13} /> Created in Notion — Open page <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: 12.5,
                          color: T.danger,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <AlertTriangle size={13} /> {notionError}
                      </span>
                    )}
                  </div>
                )}

                {/* content */}
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: tab === 'preview' ? '6px 18px 24px' : 0,
                    minHeight: 0
                  }}
                >
                  {tab === 'preview' ? (
                    <div className="prev" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        padding: '16px 18px',
                        color: T.text,
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {out.notes}
                    </pre>
                  )}
                </div>

                <div
                  style={{
                    padding: '9px 15px',
                    borderTop: `1px solid ${T.lineSoft}`,
                    fontSize: 11.5,
                    color: T.faint,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>
                    Send straight to Notion above, or paste under{' '}
                    <b style={{ color: T.dim }}>
                      {unit} → {topic}
                    </b>{' '}
                    manually: type <b style={{ color: T.dim }}>/page</b>, name it, open it, paste.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        account={account}
        onClose={() => {
          setSettingsOpen(false)
          refreshAccount()
        }}
        onSignOut={async () => {
          await window.api.auth.logout()
          setSettingsOpen(false)
          setAccount(null)
          setAuthOpen(true)
        }}
        onUpgrade={() => {
          setSettingsOpen(false)
          setPaywall({ code: 'pro_required', reasons: ['opus'] })
        }}
      />

      <BatchModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        units={units}
        unit={unit}
        setUnit={setUnit}
        options={{ depth, mode, custom: customInstructions }}
        openPicker={openPicker}
      />

      <NotionPagePicker
        open={!!picker}
        heading={picker?.heading || ''}
        subheading={picker?.subheading}
        initialQuery={picker?.initialQuery || ''}
        fetchResults={picker?.fetchResults || (async () => [])}
        createLabel={picker?.createLabel}
        onCreateNew={picker?.onCreateNew}
        onPick={(p) => {
          picker?.resolve(p)
          setPicker(null)
        }}
        onClose={() => {
          picker?.reject(new Error('Cancelled'))
          setPicker(null)
        }}
      />

      <AuthModal
        open={authOpen}
        dismissable={!!account}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => {
          setAuthOpen(false)
          refreshAccount()
        }}
      />

      <PaywallModal info={paywall} onClose={() => setPaywall(null)} />
    </div>
  )
}
