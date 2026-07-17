import React, { useEffect, useState } from 'react'
import { Search, FileText, Plus, X, Loader2 } from 'lucide-react'
import { T } from '../theme'

export interface PickerPage {
  id: string
  title: string
  icon?: string
}

interface Props {
  open: boolean
  heading: string
  subheading?: string
  initialQuery: string
  fetchResults: (query: string) => Promise<PickerPage[]>
  onPick: (page: PickerPage) => void
  onCreateNew?: () => Promise<PickerPage>
  createLabel?: string
  onClose: () => void
}

export default function NotionPagePicker({
  open,
  heading,
  subheading,
  initialQuery,
  fetchResults,
  onPick,
  onCreateNew,
  createLabel,
  onClose
}: Props): React.JSX.Element | null {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PickerPage[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const runSearch = async (q: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const r = await fetchResults(q)
      setResults(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      runSearch(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 60
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxHeight: '70vh',
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
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: T.text, fontWeight: 600 }}>
              {heading}
            </div>
            {subheading && (
              <div style={{ fontSize: 12, color: T.dim, marginTop: 4, lineHeight: 1.5 }}>{subheading}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint, padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
            placeholder="Search Notion pages…"
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              background: T.panelHi,
              border: `1px solid ${T.lineSoft}`,
              color: T.text,
              fontSize: 13
            }}
          />
          <button
            onClick={() => runSearch(query)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: T.blue,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 10px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.dim, fontSize: 12.5, padding: 12 }}>
              <Loader2 size={14} className="spin" /> Searching…
            </div>
          )}
          {!loading && error && (
            <div style={{ color: T.danger, fontSize: 12.5, padding: 12, lineHeight: 1.5 }}>{error}</div>
          )}
          {!loading && !error && results.length === 0 && (
            <div style={{ color: T.faint, fontSize: 12.5, padding: 12, lineHeight: 1.6 }}>
              No pages found. Make sure this page has been shared with your integration in Notion
              (••• menu → Connections → your integration).
            </div>
          )}
          {!loading &&
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: T.text,
                  fontSize: 13
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.panelHi)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {p.icon ? <span>{p.icon}</span> : <FileText size={14} color={T.faint} />}
                {p.title}
              </button>
            ))}
        </div>

        {onCreateNew && (
          <div style={{ padding: 12, borderTop: `1px solid ${T.lineSoft}` }}>
            <button
              disabled={creating}
              onClick={async () => {
                setCreating(true)
                try {
                  const p = await onCreateNew!()
                  onPick(p)
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setCreating(false)
                }
              }}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: 8,
                border: `1px dashed ${T.line}`,
                background: 'transparent',
                color: T.dim,
                cursor: creating ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12.5
              }}
            >
              {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              {createLabel || 'Create new page here'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
