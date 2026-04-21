import type { PrepareResult } from '../ai/profile'
import type { ParsedChat } from '../parser/types'
import type { ModuleId } from '../store/chatLibrary'

interface Props {
  chat: ParsedChat
  prepared: PrepareResult
  onAccept: () => void
  onCancel: () => void
  moduleId?: ModuleId
}

// The critical trust moment. Show exactly what's going out and why.
// Transparency builds more trust than hiding things does.
export function ConsentScreen({
  chat,
  prepared,
  onAccept,
  onCancel,
}: Props) {
  const pctOfChat = ((prepared.messagesSent / Math.max(1, prepared.totalAvailable)) * 100).toFixed(1)
  const isFixture = prepared.analyzerKind === 'fixture'

  return (
    <div className="min-h-[80vh] flex items-start justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className={`pill-pop mb-6 ${isFixture ? 'text-a' : 'text-b'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft ${isFixture ? 'bg-a' : 'bg-b'}`} />
          <span className="font-mono uppercase tracking-[0.14em]">
            {isFixture ? 'test mode · nothing leaves' : 'tea is about to send slices to the AI'}
          </span>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-6 tracking-tight">
          Before the <span className="gradient-text-cool">AI</span> kicks in,
          <br />
          <span className="italic text-ink-muted">quick check.</span>
        </h2>

        <p className="serif-body text-lg md:text-xl text-ink-muted mb-10">
          So the AI can read you, tea sends a handful of messages over. Here's exactly what goes — and what doesn't.
        </p>

        {/* The number block */}
        <div className="card space-y-6 mb-6">
          <Row
            label={isFixture ? 'Messages in the slice' : 'Messages going out'}
            value={prepared.messagesSent.toLocaleString('en-US')}
            suffix={`of ${prepared.totalAvailable.toLocaleString('en-US')} (${pctOfChat}%)`}
          />
          <Row
            label="What's picked"
            value="the moments that matter"
            suffix="Beginnings, endings, long messages, late-night streaks, turning points"
          />
          <Row
            label="Names"
            value="hidden"
            suffix={chat.participants.map((p, i) => `${p} becomes Person ${String.fromCharCode(65 + i)}`).join(', ')}
          />
          <Row
            label="Also stripped"
            value="emails, links, phone numbers"
            suffix="gone before the text leaves"
          />
          <Row
            label="Who reads along"
            value={isFixture ? 'nobody — just your device' : 'Anthropic Claude · USA'}
            suffix={
              isFixture
                ? 'in test mode everything stays local'
                : '30-day retention, no training, transfer under EU SCCs / DPF'
            }
          />
        </div>

        {/* Art. 9 GDPR explicit consent — chats can contain special-category data */}
        {!isFixture && (
          <div className="bg-pop-yellow border-2 border-ink p-5 mb-6" style={{ boxShadow: '4px 4px 0 #0A0A0A', transform: 'rotate(-0.3deg)' }}>
            <div className="label-mono mb-2 text-ink">Explicit consent · Art. 9 GDPR</div>
            <p className="serif-body text-base text-ink leading-snug">
              Chats can contain sensitive stuff — health, sex life, politics, beliefs. By starting
              this analysis, you give <strong className="not-italic">explicit consent</strong> under
              Art. 9(2)(a) GDPR for that content to be processed by an AI in the USA, as described
              above and in the{' '}
              <a href="#" className="underline">privacy policy</a>.
              You can withdraw it any time — just don't run further analyses. Already-sent slices
              clear themselves after 30 days.
            </p>
          </div>
        )}

        {/* Trust reassurance — plain language */}
        <div className="bg-bg-surface/60 border border-line/60 rounded-xl p-5 mb-10">
          <div className="label-mono mb-3 text-b">What tea never does</div>
          <ul className="serif-body text-base md:text-lg text-ink space-y-2">
            <li>
              <span className="text-a">✓</span> Save your chat on our servers — no way.
            </li>
            <li>
              <span className="text-a">✓</span> Identify you or your people — names are out first.
            </li>
            <li>
              <span className="text-a">✓</span> Use your messages for AI training — nope.
            </li>
            <li>
              <span className="text-ink-faint">·</span> Beyond the small slice, everything stays on your device.
            </li>
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAccept}
            className="flex-1 btn-pop px-6 py-4 text-base"
          >
            <span aria-hidden>✨</span>
            {isFixture ? 'Start the analysis' : 'Consent & start'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border border-line rounded-full font-sans font-medium text-base text-ink-muted hover:border-ink hover:text-ink hover:bg-bg-raised/40 transition-all"
          >
            Back to the numbers
          </button>
        </div>

        <p className="text-ink-faint text-[11px] font-mono mt-6 leading-relaxed">
          Hitting "{isFixture ? 'Start the analysis' : 'Consent & start'}" confirms: the chat is yours or you were
          part of it, and — in live mode — you explicitly consent to the AI processing described
          above.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 flex-wrap border-b border-line/40 pb-4 last:border-b-0 last:pb-0">
      <span className="label-mono shrink-0">{label}</span>
      <div className="text-right min-w-0 flex-1">
        <div className="metric-num text-lg md:text-xl text-ink">{value}</div>
        {suffix && <div className="text-ink-muted font-mono text-[11px] mt-1">{suffix}</div>}
      </div>
    </div>
  )
}
