import React, { useEffect, useState } from 'react'
import {
  X,
  Check,
  Loader2,
  KeyRound,
  AlertTriangle,
  Cpu,
  Lock,
  Sparkles,
  LogOut,
  User,
  Palette,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { T } from '../theme'
import { useThemeMode, useAccentHue, type ThemeMode } from '../lib/theme-mode'
import type { AccountSummary } from '../App'

const THEME_OPTIONS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon }
]

// Quick-pick accent hues (OKLCH degrees) shown as dots under the slider. 6° ≈ the default rose.
const ACCENT_PRESETS = [6, 25, 55, 90, 150, 190, 240, 275, 320]

interface Props {
  open: boolean
  onClose: () => void
  account: AccountSummary | null
  onSignOut: () => void
  onUpgrade: () => void
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

export default function SettingsModal({
  open,
  onClose,
  account,
  onSignOut,
  onUpgrade
}: Props): React.JSX.Element | null {
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode()
  const { hue: accentHue, setHue: setAccentHue } = useAccentHue()
  const [notionTokenSet, setNotionTokenSet] = useState(false)
  const [notionWorkspaceName, setNotionWorkspaceName] = useState('')
  const [anthropicModelId, setAnthropicModelId] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [showManualToken, setShowManualToken] = useState(false)

  const isPro = account?.plan === 'pro'

  const refresh = async (): Promise<void> => {
    const s = await window.api.settings.get()
    setNotionTokenSet(s.notionTokenSet)
    setNotionWorkspaceName(s.notionWorkspaceName || '')
    setAnthropicModelId(s.anthropicModelId)
  }

  useEffect(() => {
    if (open) {
      refresh()
      setTestResult(null)
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
    // Opus is a Pro-only model — the server enforces this too, but block the switch here for clarity.
    if (modelId === 'claude-opus-4-8' && !isPro) {
      onUpgrade()
      return
    }
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={17} color={T.blue} />
            <span
              style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: T.text, fontWeight: 600 }}
            >
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
          {/* ---- Account ---- */}
          {account && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <User size={15} color={T.blue} />
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Account</label>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 9,
                  background: T.panelHi,
                  border: `1px solid ${T.lineSoft}`
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: T.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {account.email}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: T.dim,
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {isPro ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: T.blue,
                          fontWeight: 600
                        }}
                      >
                        <Sparkles size={11} /> Pro
                      </span>
                    ) : (
                      <>
                        <span>
                          {Math.max(account.limits.freeNotes - account.freeNotesUsed, 0)} of{' '}
                          {account.limits.freeNotes} free notes left
                        </span>
                        {account.jotsBalance > 0 && <span>· {account.jotsBalance} Jots</span>}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  style={{
                    padding: '7px 11px',
                    borderRadius: 7,
                    border: `1px solid ${T.lineSoft}`,
                    background: 'transparent',
                    color: T.faint,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <LogOut size={12} /> Sign out
                </button>
              </div>
              {!isPro && (
                <button
                  onClick={onUpgrade}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: '9px',
                    borderRadius: 8,
                    border: 'none',
                    background: T.blue,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7
                  }}
                >
                  <Sparkles size={13} /> Upgrade to Pro
                </button>
              )}
            </div>
          )}

          {account && <div style={{ height: 1, background: T.lineSoft }} />}

          {/* ---- Generation model ---- */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cpu size={15} color={T.blue} />
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Generation model
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 5,
                background: T.panelHi,
                padding: 3,
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`,
                marginBottom: 10
              }}
            >
              {ANTHROPIC_MODELS.map((m) => {
                const locked = m.id === 'claude-opus-4-8' && !isPro
                return (
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      background: anthropicModelId === m.id ? T.blue : 'transparent',
                      color: anthropicModelId === m.id ? '#fff' : T.dim
                    }}
                  >
                    {m.label}
                    {locked && <Lock size={11} />}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: T.faint, margin: 0, lineHeight: 1.5 }}>
              Notes are generated on Notely.ai&rsquo;s servers — no API key needed.
              {!isPro ? ' Opus is a Pro model.' : ''}
            </p>
          </div>

          <div style={{ height: 1, background: T.lineSoft }} />

          {/* ---- Appearance ---- */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Palette size={15} color={T.blue} />
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Appearance</label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 5,
                background: T.panelHi,
                padding: 3,
                borderRadius: 9,
                border: `1px solid ${T.lineSoft}`
              }}
            >
              {THEME_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setThemeMode(id)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    background: themeMode === id ? T.blue : 'transparent',
                    color: themeMode === id ? '#fff' : T.dim
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* accent colour */}
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}
              >
                <span style={{ fontSize: 12, color: T.dim }}>Accent colour</span>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: T.blue,
                    border: `1px solid ${T.lineSoft}`
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={accentHue}
                onChange={(e) => setAccentHue(Number(e.target.value))}
                className="accent-hue"
                aria-label="Accent colour hue"
              />
              <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                {ACCENT_PRESETS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setAccentHue(h)}
                    aria-label={`Accent hue ${h}`}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      padding: 0,
                      background: `oklch(0.62 0.17 ${h})`,
                      border: accentHue === h ? `2px solid ${T.text}` : `1px solid ${T.lineSoft}`
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 11, color: T.faint, margin: '9px 0 0', lineHeight: 1.5 }}>
                Recolours buttons, links and highlights. Slides &amp; transcript keep their own
                colours.
              </p>
            </div>
          </div>

          <div style={{ height: 1, background: T.lineSoft }} />

          {/* ---- Notion ---- */}
          <div>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                display: 'block',
                marginBottom: 8
              }}
            >
              Notion{' '}
              <span style={{ color: T.faint, fontWeight: 400 }}>
                — optional, for “Send to Notion”
              </span>
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
                    Connected
                    {notionWorkspaceName ? (
                      <>
                        {' '}
                        to <b>{notionWorkspaceName}</b>
                      </>
                    ) : null}
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
                  Click Connect, then choose which pages Notely.ai can write to — right inside
                  Notion. No token to copy, no manual sharing. Without this, Notely.ai still works
                  as a copy/paste markdown tool.
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
