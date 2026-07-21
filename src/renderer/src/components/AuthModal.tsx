import React, { useState } from 'react'
import { X, Loader2, LogIn, AlertTriangle } from 'lucide-react'
import { T } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
  onAuthed: () => void
  // When false, the modal can't be dismissed without signing in (first-run gate).
  dismissable?: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 9,
  background: T.panelHi,
  border: `1px solid ${T.lineSoft}`,
  color: T.text,
  fontSize: 13,
  outline: 'none'
}

export default function AuthModal({
  open,
  onClose,
  onAuthed,
  dismissable = true
}: Props): React.JSX.Element | null {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const canSubmit = !!email.trim() && !!password && !loading

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? window.api.auth.login : window.api.auth.register
      const r = (await fn(email.trim(), password)) as { ok: boolean; error?: string }
      if (!r.ok) {
        setError(r.error || 'Something went wrong.')
        return
      }
      setEmail('')
      setPassword('')
      onAuthed()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 70
      }}
      onClick={dismissable ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          background: T.panel,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: 22
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogIn size={17} color={T.blue} />
            <span
              style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: T.text, fontWeight: 600 }}
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </span>
          </div>
          {dismissable && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint }}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: T.dim, margin: '0 0 16', lineHeight: 1.5 }}>
          {mode === 'login'
            ? 'Sign in to Notely.ai to generate notes.'
            : 'Sign up to get started — your first 5 notes are free.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
            autoComplete="email"
            spellCheck={false}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Password (min 8 characters)' : 'Password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          {error && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
                color: T.danger,
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              {error}
            </div>
          )}
          <button
            disabled={!canSubmit}
            onClick={submit}
            style={{
              padding: '11px',
              borderRadius: 9,
              border: 'none',
              background: canSubmit ? T.blue : T.lineSoft,
              color: canSubmit ? '#fff' : T.faint,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading ? <Loader2 size={15} className="spin" /> : null}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: T.dim }}>
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: T.blue,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              padding: 0
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
