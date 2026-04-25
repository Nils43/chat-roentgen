import type { HardFacts } from '../analysis/hardFacts'
import type { Locale } from '../i18n'

// Hard Facts share card — mirrors the in-app opener punch ("11,090 messages
// over 580 days. Antonia writes 50%. X takes the rest.") in the same
// pink/ink/yellow brand template the AI cards use, sized 1080×1350 for
// Instagram-friendly 4:5.

interface Props {
  facts: HardFacts
  locale: Locale
}

const WIDTH = 1080
const HEIGHT = 1350

export function HardFactsShareCard({ facts, locale }: Props) {
  const r = (en: string, de: string) => (locale === 'de' ? de : en)
  const shareLeaderIdx = facts.perPerson.reduce(
    (best, p, i, arr) => (p.sharePct > arr[best].sharePct ? i : best),
    0,
  )
  const shareLeader = facts.perPerson[shareLeaderIdx]?.author ?? ''
  const shareLeaderPct = facts.perPerson[shareLeaderIdx]?.sharePct ?? 0
  const shareOther =
    facts.perPerson.length === 2
      ? facts.perPerson[shareLeaderIdx === 0 ? 1 : 0]?.author ?? ''
      : ''
  const messages = facts.totalMessages.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US')

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
        }}
      >
        <span>{r('hard facts', 'hard facts')}</span>
        <span>spillteato.me</span>
      </div>

      {/* big number — total messages */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 64,
          right: 64,
          fontSize: 240,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          fontWeight: 700,
        }}
      >
        {messages}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 410,
          left: 64,
          right: 64,
          fontSize: 56,
          lineHeight: 1.05,
          fontStyle: 'italic',
          fontWeight: 400,
        }}
      >
        {r(
          `messages over ${facts.durationDays} days.`,
          `Nachrichten in ${facts.durationDays} Tagen.`,
        )}
      </div>

      {/* asymmetry headline */}
      <div
        style={{
          position: 'absolute',
          top: 560,
          left: 64,
          right: 64,
          fontSize: 64,
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          fontWeight: 700,
          maxHeight: 380,
          overflow: 'hidden',
        }}
      >
        <span>{shareLeader}</span>{' '}
        <span style={{ fontWeight: 400, fontStyle: 'italic' }}>
          {r('writes', 'macht')}
        </span>{' '}
        <span
          style={{
            background: '#FFE234',
            padding: '0 18px',
            display: 'inline-block',
          }}
        >
          {Math.round(shareLeaderPct)}%
        </span>
        {shareOther && (
          <>
            <span style={{ fontWeight: 400 }}>. </span>
            <span>{shareOther}</span>{' '}
            <span style={{ fontWeight: 400, fontStyle: 'italic' }}>
              {r('takes the rest.', 'den rest.')}
            </span>
          </>
        )}
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
        <MetricCard
          label={r('ACTIVE DAYS', 'AKTIVE TAGE')}
          value={String(facts.activeDays)}
        />
        <MetricCard
          label={r('LONGEST SILENCE', 'LÄNGSTE STILLE')}
          value={r(
            `${facts.longestSilenceDays} d`,
            `${facts.longestSilenceDays} T`,
          )}
        />
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
          fontSize: 48,
          lineHeight: 1.1,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  )
}
