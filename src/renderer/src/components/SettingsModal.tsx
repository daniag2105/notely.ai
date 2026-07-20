import React, { useEffect, useState } from 'react'
import { X, Check, Loader2, KeyRound, AlertTriangle, Cpu } from 'lucide-react'
import { T } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
}

const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { id: 'claude-sonnet-5', label: 'Sonnet' },
  { id: 'claude-opus-4-8', label: 'Opus' }
]

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
          autoComplete="off"
          spellCheck={false}
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
  const [notionWorkspaceName, setNotionWorkspaceName] = useState('')
  const [anthropicModelId, setAnthropicModelId] = useState('')
  const [anthropicKeySet, setAnthropicKeySet] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [llmResult, setLlmResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [llmTesting, setLlmTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [showManualToken, setShowManualToken] = useState(false)

  const refresh = async (): Promise<void> => {
    const s = await window.api.settings.get()
    setNotionTokenSet(s.notionTokenSet)
    setNotionWorkspaceName(s.notionWorkspaceName || '')
    setAnthropicModelId(s.anthropicModelId)
    setAnthropicKeySet(s.anthropicKeySet)
  }

  useEffect(() => {
    if (open) {
      refresh()
      setTestResult(null)
      setLlmResult(null)
      setConnectError('')
    }
  }, [open])

  const connectNotion = async (): Promise<void> => {
    setConnecting(true)
    setConnectError('')
    try {
      const r = await window.api.notion.connect()
      if (!r.ok) setConnectError(r.error || 'Could not connect to Notion.')
      await refresh()
    } finally {
      setConnecting(false)
    }
  }

  const disconnectNotion = async (): Promise<void> => {
    await window.api.notion.disconnect()
    setTestResult(null)
    await refresh()
  }

  const switchAnthropicModel = async (modelId: string): Promise<void> => {
    setAnthropicModelId(modelId)
    await window.api.settings.setAnthropicModelId(modelId)
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu size={15} color={T.blue} />
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Generation (Claude)</label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 5,
                background: T.panelHi,
                padding: 3,
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`,
                marginBottom: 12
              }}
            >
              {ANTHROPIC_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => switchAnthropicModel(m.id)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    fontWeight: 600,
                    background: anthropicModelId === m.id ? T.blue : 'transparent',
                    color: anthropicModelId === m.id ? '#fff' : T.dim
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <SecretField
              label="Anthropic API key"
              placeholder="sk-ant-…"
              isSet={anthropicKeySet}
              onSave={async (v) => {
                await window.api.settings.setAnthropicKey(v)
                refresh()
              }}
              onClear={async () => {
                await window.api.settings.clearAnthropicKey()
                refresh()
              }}
              hint={`Required — Notely.ai uses Claude to write your notes. Create a key at console.anthropic.com (billed by Anthropic per their usage pricing). Stored encrypted locally via macOS Keychain, the same way your Notion token is — it only ever leaves this app to call Anthropic's API directly over HTTPS.`}
            />

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
                  {llmResult.ok ? (
                    <Check size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                  )}
                  {llmResult.ok ? 'Connected' : llmResult.error}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: T.lineSoft }} />

          {/* ---- Notion ---- */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: 'block', marginBottom: 8 }}>
              Notion <span style={{ color: T.faint, fontWeight: 400 }}>— optional, for “Send to Notion”</span>
            </label>

            {notionTokenSet ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '10px 12px',
                    borderRadius: 9,
                    background: T.panelHi,
                    border: `1px solid ${T.lineSoft}`
                  }}
                >
                  <Check size={15} color={T.teal} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12.5, color: T.text }}>
                    Connected{notionWorkspaceName ? <> to <b>{notionWorkspaceName}</b></> : null}
                  </div>
                  <button
                    onClick={disconnectNotion}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 7,
                      border: `1px solid ${T.lineSoft}`,
                      background: 'transparent',
                      color: T.faint,
                      cursor: 'pointer',
                      fontSize: 11.5
                    }}
                  >
                    Disconnect
                  </button>
                </div>
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
              </>
            ) : (
              <>
                <button
                  disabled={connecting}
                  onClick={connectNotion}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: 'none',
                    background: T.blue,
                    color: '#fff',
                    cursor: connecting ? 'default' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {connecting ? <Loader2 size={14} className="spin" /> : null}
                  {connecting ? 'Waiting for your browser…' : 'Connect Notion'}
                </button>
                <p style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
                  Click Connect, then choose which pages Notely.ai can write to — right inside Notion. No
                  token to copy, no manual sharing. Without this, Notely.ai still works as a copy/paste
                  markdown tool.
                </p>
                {connectError && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11.5,
                      color: T.danger,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      lineHeight: 1.5
                    }}
                  >
                    <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                    {connectError}
                  </div>
                )}
                <button
                  onClick={() => setShowManualToken((v) => !v)}
                  style={{
                    marginTop: 10,
                    background: 'none',
                    border: 'none',
                    color: T.dim,
                    cursor: 'pointer',
                    fontSize: 11,
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {showManualToken ? 'Hide' : 'Paste a token instead'}
                </button>
                {showManualToken && (
                  <div style={{ marginTop: 10 }}>
                    <SecretField
                      label="Notion integration token"
                      placeholder="ntn_…"
                      isSet={false}
                      onSave={async (v) => {
                        await window.api.settings.setNotionToken(v)
                        refresh()
                      }}
                      onClear={async () => {
                        await window.api.settings.clearNotionToken()
                        refresh()
                      }}
                      hint="Advanced: paste an internal integration token from notion.so/my-integrations, then share your pages with it (••• menu → Connections)."
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
