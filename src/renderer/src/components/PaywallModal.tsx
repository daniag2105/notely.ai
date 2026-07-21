import React from 'react'
import { X, Lock, Sparkles } from 'lucide-react'
import { T } from '../theme'
import type { PaywallInfo } from '../App'

const FEATURE_LABEL: Record<string, string> = {
  detailed: 'Detailed notes',
  custom: 'Custom instructions',
  opus: 'the Opus model',
  batch: 'Batch import'
}

// Shown when the backend blocks a generation on entitlement grounds. Purely informational for now —
// the "Upgrade to Pro" button is a placeholder until checkout is wired (payments are deferred; for
// testing, grant Pro/Jots via the backend's /api/admin/set-entitlement endpoint).
export default function PaywallModal({
  info,
  onClose
}: {
  info: PaywallInfo | null
  onClose: () => void
}): React.JSX.Element | null {
  if (!info) return null

  let title: string
  let body: string
  if (info.code === 'pro_required') {
    const feats = info.reasons.map((r) => FEATURE_LABEL[r] || r)
    const list = feats.length ? feats.join(', ') : 'This feature'
    title = feats.length > 1 ? 'Pro features' : 'A Pro feature'
    body = `${list} ${feats.length > 1 ? 'are' : 'is'} part of Notely.ai Pro. Upgrade to unlock detailed notes, custom instructions, the Opus model, batch import, and unlimited generations.`
  } else if (info.code === 'figures_exhausted') {
    title = 'Free slide figures used up'
    body =
      "You've used your free slide-figure extraction. Pulling diagrams out of slides is included on Notely.ai Pro — upgrade to keep embedding them in your notes."
  } else {
    title = "You're out of free notes"
    body =
      "You've used all 5 free notes. Subscribe to Notely.ai Pro for unlimited notes, or top up with Jots to keep going without a subscription."
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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 410,
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
            alignItems: 'flex-start',
            marginBottom: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: T.blueBg,
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Lock size={17} color={T.blue} />
            </div>
            <span
              style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: T.text, fontWeight: 600 }}
            >
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint }}
          >
            <X size={17} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: T.dim, lineHeight: 1.6, margin: '0 0 18' }}>{body}</p>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 14px',
              borderRadius: 9,
              border: `1px solid ${T.lineSoft}`,
              background: 'transparent',
              color: T.dim,
              cursor: 'pointer',
              fontSize: 12.5
            }}
          >
            Not now
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 9,
              border: 'none',
              background: T.blue,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 7
            }}
          >
            <Sparkles size={14} /> Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  )
}
