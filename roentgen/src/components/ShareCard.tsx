import { forwardRef } from 'react'
import type { RelationshipPayload } from '../ai/types'
import type { Locale } from '../i18n'

// Share card — rendered at its real 1080×1350 size so html-to-image can
// capture a crisp 4:5 Instagram-ready PNG regardless of viewport. The
// caller shows a scaled-down preview via CSS transform on an outer wrapper;
// this component itself never scales, so the capture stays pixel-perfect.

interface Props {
  payload: RelationshipPayload
  participants: string[]
  locale: Locale
}

const WIDTH = 1080
const HEIGHT = 1350

export const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  { payload, participants, locale },
  ref,
) {
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const names = participants.slice(0, 2).join(' & ')
  const attunement = payload.kopplung?.attunement ?? null
  const dyadKey = payload.bindungsdyade?.konstellation ?? null

  return (
    <div
      ref={ref}
      style={{
        width: WIDTH,
        height: HEIGHT,
        background: '#FF90BB',
        position: 'relative',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#0A0A0A',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* top stamp */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 64,
          right: 64,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: '"Courier New", monospace',
          fontSize: 22,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: '#0A0A0A',
        }}
      >
        <span>{r('relationship analysis', 'beziehungsanalyse')}</span>
        <span>spillteato.me</span>
      </div>

      {/* participant names */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 64,
          right: 64,
          fontSize: 88,
          lineHeight: 0.92,
          letterSpacing: '-0.02em',
          fontWeight: 700,
        }}
      >
        {names}
      </div>

      {/* core insight — the headline */}
      <div
        style={{
          position: 'absolute',
          top: 310,
          left: 64,
          right: 64,
          fontSize: 68,
          lineHeight: 1.08,
          letterSpacing: '-0.01em',
          fontStyle: 'italic',
          fontWeight: 400,
          maxHeight: 650,
          overflow: 'hidden',
        }}
      >
        “{payload.kern_insight}”
      </div>

      {/* metrics strip */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          bottom: 210,
          display: 'flex',
          gap: 16,
        }}
      >
        {attunement !== null && (
          <MetricCard
            label={r('ATTUNEMENT', 'ATTUNEMENT')}
            value={`${attunement}/100`}
          />
        )}
        {dyadKey && (
          <MetricCard
            label={r('DYNAMIC', 'DYNAMIK')}
            value={dyadLabelShort(dyadKey, locale)}
          />
        )}
      </div>

      {/* bottom stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
          background: '#0A0A0A',
          color: '#FFE234',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 64px',
        }}
      >
        <span
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 22,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          {r('read your chat', 'lies deinen chat')}
        </span>
        <span
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 48,
            fontStyle: 'italic',
            fontWeight: 700,
          }}
        >
          spillteato.me
        </span>
      </div>
    </div>
  )
})

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: '#FFFFFF',
        border: '3px solid #0A0A0A',
        boxShadow: '8px 8px 0 #0A0A0A',
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          fontFamily: '"Courier New", monospace',
          fontSize: 18,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(10,10,10,0.6)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 38,
          lineHeight: 1.1,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// Shorthand for the attachment dyad enum. Full labels live in the main view;
// the share card needs something pithy that fits one line.
function dyadLabelShort(key: string, locale: Locale): string {
  const de = locale === 'de'
  const map: Record<string, { en: string; de: string }> = {
    secure_secure: { en: 'secure · secure', de: 'sicher · sicher' },
    anxious_avoidant: { en: 'anxious · avoidant', de: 'ängstlich · vermeidend' },
    avoidant_anxious: { en: 'avoidant · anxious', de: 'vermeidend · ängstlich' },
    anxious_anxious: { en: 'anxious · anxious', de: 'ängstlich · ängstlich' },
    avoidant_avoidant: { en: 'avoidant · avoidant', de: 'vermeidend · vermeidend' },
    secure_anxious: { en: 'secure · anxious', de: 'sicher · ängstlich' },
    anxious_secure: { en: 'anxious · secure', de: 'ängstlich · sicher' },
    secure_avoidant: { en: 'secure · avoidant', de: 'sicher · vermeidend' },
    avoidant_secure: { en: 'avoidant · secure', de: 'vermeidend · sicher' },
    disorganisiert_beteiligt: { en: 'disorganised mix', de: 'desorganisiert' },
    unklar: { en: 'mixed signal', de: 'gemischt' },
  }
  const entry = map[key]
  if (!entry) return key
  return de ? entry.de : entry.en
}
