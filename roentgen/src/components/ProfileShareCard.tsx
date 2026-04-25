import type { PersonProfile } from '../ai/types'
import type { Locale } from '../i18n'

// Profile share card — same 1080×1350 brand template as ShareCard, but
// pulls from a single-person PersonProfile. Highlights the kern_insight
// (the headline punch) plus two cheap-to-grasp metrics: attachment style
// and Horney orientation.

interface Props {
  profile: PersonProfile
  locale: Locale
}

const WIDTH = 1080
const HEIGHT = 1350

export function ProfileShareCard({ profile, locale }: Props) {
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const name = profile.person ?? '—'
  const bowlby = bowlbyShort(profile.bowlby?.tendenz, locale)
  const horney = horneyShort(profile.horney?.orientierung, locale)

  return (
    <div
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
        <span>{r('portrait', 'portrait')}</span>
        <span>spillteato.me</span>
      </div>

      {/* person name */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 64,
          right: 64,
          fontSize: 110,
          lineHeight: 0.92,
          letterSpacing: '-0.02em',
          fontStyle: 'italic',
          fontWeight: 700,
        }}
      >
        {name}.
      </div>

      {/* core insight */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          left: 64,
          right: 64,
          fontSize: 64,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          fontStyle: 'italic',
          fontWeight: 400,
          maxHeight: 640,
          overflow: 'hidden',
        }}
      >
        “{profile.kern_insight}”
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
        {bowlby && (
          <MetricCard
            label={r('ATTACHMENT', 'BINDUNG')}
            value={bowlby}
          />
        )}
        {horney && (
          <MetricCard
            label={r('STANCE', 'HALTUNG')}
            value={horney}
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
}

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
          fontSize: 36,
          lineHeight: 1.1,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// Pithy one-liner for the Bowlby attachment tendency. Long-form labels live
// in ProfileView; here we want something that fits on one card line.
function bowlbyShort(t: string | undefined, locale: Locale): string | null {
  if (!t) return null
  const de = locale === 'de'
  const map: Record<string, { en: string; de: string }> = {
    sicher: { en: 'secure', de: 'sicher' },
    aengstlich_ambivalent: { en: 'anxious', de: 'ängstlich' },
    vermeidend: { en: 'avoidant', de: 'vermeidend' },
    desorganisiert: { en: 'disorganised', de: 'desorganisiert' },
  }
  const entry = map[t]
  if (!entry) return t
  return de ? entry.de : entry.en
}

// Karen Horney's three orientations, condensed for the card.
function horneyShort(o: string | undefined, locale: Locale): string | null {
  if (!o) return null
  const de = locale === 'de'
  const map: Record<string, { en: string; de: string }> = {
    zu_menschen: { en: 'toward people', de: 'zu Menschen hin' },
    gegen_menschen: { en: 'against people', de: 'gegen Menschen' },
    von_menschen: { en: 'away from people', de: 'von Menschen weg' },
    gemischt: { en: 'mixed', de: 'gemischt' },
  }
  const entry = map[o]
  if (!entry) return o
  return de ? entry.de : entry.en
}
