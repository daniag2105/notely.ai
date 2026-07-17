import React, { useEffect, useState } from 'react'
import { X, Check, Loader2, KeyRound, AlertTriangle, Cpu } from 'lucide-react'
import { T } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
}

function SecretField({
  label,
  placeholder,
  isSet,
  onSave,
  onClear,
  hint,
  extra
}: {
  label: string
  placeholder: string
  isSet: boolean
  onSave: (v: string) => Promise<void>
  onClear: () => Promise<void>
  hint: string
  extra?: React.ReactNode
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</label>
        {isSet && (
          <span
            style={{
              fontSize: 10.5,
              padding: '2px 7px',
              borderRadius: 5,
              background: T.tealBg,
              color: T.teal,
              fontWeight: 600
            }}
          >
            set
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isSet ? '•••••••••••••••• (paste to replace)' : placeholder}
          style={{
            flex: 1,
            padding: '9px 11px',
            borderRadius: 8,
            background: T.panelHi,
            border: `1px solid ${T.lineSoft}`,
            color: T.text,
            fontSize: 12.5,
            fontFamily: 'ui-monospace, Menlo, monospace'
          }}
        />
        <button
          disabled={!value.trim() || saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(value.trim())
              setValue('')
            } finally {
              setSaving(false)
            }
          }}
          style={{
            padding: '9px 13px',
            borderRadius: 8,
            border: 'none',
            background: value.trim() ? T.blue : T.lineSoft,
            color: value.trim() ? '#fff' : T.faint,
            cursor: value.trim() ? 'pointer' : 'not-allowed',
            fontSize: 12.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          {saving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
          Save
        </button>
        {isSet && (
          <button
            onClick={() => onClear()}
            style={{
              padding: '9px 11px',
              borderRadius: 8,
              border: `1px solid ${T.lineSoft}`,
              background: 'transparent',
              color: T.faint,
              cursor: 'pointer',
              fontSize: 12.5
            }}
          >
            Clear
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>{hint}</p>
      {extra}
    </div>
  )
}

export default function SettingsModal({ open, onClose }: Props): React.JSX.Element | null {
  const [notionTokenSet, setNotionTokenSet] = useState(false)
  const [modelId, setModelId] = useState('')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [llmResult, setLlmResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [llmTesting, setLlmTesting] = useState(false)

  const refresh = async (): Promise<void> => {
    const s = await window.api.settings.get()
    setNotionTokenSet(s.notionTokenSet)
    setModelId(s.modelId)
    setOllamaBaseUrl(s.ollamaBaseUrl)
  }

  useEffect(() => {
    if (open) {
      refresh()
      setTestResult(null)
      setLlmResult(null)
    }
  }, [open])

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
          width: 480,
          background: T.panel,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={17} color={T.blue} />
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: T.text, fontWeight: 600 }}>
              Settings
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint }}
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Cpu size={15} color={T.blue} />
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Local model</label>
            </div>
            <div
              style={{
                padding: '9px 11px',
                borderRadius: 8,
                background: T.panelHi,
                border: `1px solid ${T.lineSoft}`,
                fontSize: 12,
                fontFamily: 'ui-monospace, Menlo, monospace',
                color: T.text,
                display: 'flex',
                flexDirection: 'column',
                gap: 3
              }}
            >
              <span>
                model: <b>{modelId || '…'}</b>
              </span>
              <span style={{ color: T.dim }}>{ollamaBaseUrl || '…'}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                disabled={llmTesting}
                onClick={async () => {
                  setLlmTesting(true)
                  setLlmResult(null)
                  try {
                    const r = await window.api.llm.checkConnection()
                    setLlmResult(r)
                  } finally {
                    setLlmTesting(false)
                  }
                }}
                style={{
                  padding: '6px 11px',
                  borderRadius: 7,
                  border: `1px solid ${T.lineSoft}`,
                  background: T.panelHi,
                  color: T.dim,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {llmTesting ? <Loader2 size={12} className="spin" /> : null}
                Test connection
              </button>
              {llmResult && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11.5,
                    color: llmResult.ok ? T.teal : T.danger,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    lineHeight: 1.5
                  }}
                >
                  {llmResult.ok ? <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} /> : <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />}
                  {llmResult.ok ? 'Connected' : llmResult.error}
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
              Notely runs entirely offline via <b style={{ color: T.dim }}>Ollama</b> — no API key needed.
              One-time setup in Terminal: <b style={{ color: T.dim }}>brew install ollama</b>, then{' '}
              <b style={{ color: T.dim }}>ollama pull {modelId || 'minicpm-v4.5'}</b> (~6GB). Make sure
              Ollama is running (<b style={{ color: T.dim }}>ollama serve</b>) before generating notes.
            </p>
          </div>

          <div style={{ height: 1, background: T.lineSoft }} />

          <SecretField
            label="Notion integration token"
            placeholder="ntn_…"
            isSet={notionTokenSet}
            onSave={async (v) => {
              await window.api.settings.setNotionToken(v)
              refresh()
            }}
            onClear={async () => {
              await window.api.settings.clearNotionToken()
              refresh()
            }}
            hint="Optional — only needed for “Send to Notion”. Create one at notion.so/my-integrations, then share your unit pages with it from the Notion ••• menu → Connections. Without this, Notely still works as a copy/paste markdown tool."
            extra={
              notionTokenSet ? (
                <div style={{ marginTop: 8 }}>
                  <button
                    disabled={testing}
                    onClick={async () => {
                      setTesting(true)
                      setTestResult(null)
                      try {
                        const r = await window.api.notion.testConnection()
                        setTestResult(r)
                      } finally {
                        setTesting(false)
                      }
                    }}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 7,
                      border: `1px solid ${T.lineSoft}`,
                      background: T.panelHi,
                      color: T.dim,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {testing ? <Loader2 size={12} className="spin" /> : null}
                    Test connection
                  </button>
                  {testResult && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11.5,
                        color: testResult.ok ? T.teal : T.danger,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {testResult.ok ? <Check size={13} /> : <AlertTriangle size={13} />}
                      {testResult.ok ? 'Connected' : testResult.error}
                    </div>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  )
}
