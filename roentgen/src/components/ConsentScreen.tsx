import type { PrepareResult } from '../ai/profile'
import type { ParsedChat } from '../parser/types'
import { MODULE_COSTS, useTokenState, type ModuleId } from '../tokens/store'

interface Props {
  chat: ParsedChat
  prepared: PrepareResult
  onAccept: () => void
  onCancel: () => void
  onOpenTokens?: () => void
  moduleId?: ModuleId
}

// The critical trust moment. Show exactly what's going out and why.
// Transparency builds more trust than hiding things does.
export function ConsentScreen({
  chat,
  prepared,
  onAccept,
  onCancel,
  onOpenTokens,
  moduleId = 'profiles',
}: Props) {
  const pctOfChat = ((prepared.messagesSent / prepared.sample.totalAvailable) * 100).toFixed(1)
  const isFixture = prepared.analyzerKind === 'fixture'
  const { balance } = useTokenState()
  const meta = MODULE_COSTS[moduleId]
  const cost = meta.cost
  const insufficient = balance < cost

  return (
    <div className="min-h-[80vh] flex items-start justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-2xl">
        <div className={`pill-pop mb-6 ${isFixture ? 'text-a' : 'text-b'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft ${isFixture ? 'bg-a' : 'bg-b'}`} />
          <span className="font-mono uppercase tracking-[0.14em]">
            {isFixture ? 'test mode · nothing leaves' : 'Decode is about to send slices to the AI'}
          </span>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-6 tracking-tight">
          Before the <span className="gradient-text-cool">AI</span> kicks in,
          <br />
          <span className="italic text-ink-muted">quick check.</span>
        </h2>

        <p className="serif-body text-lg md:text-xl text-ink-muted mb-10">
          So the AI can read you, Decode sends a handful of messages over. Here's exactly what goes — and what doesn't.
        </p>

        {/* The number block */}
        <div className="card space-y-6 mb-6">
          <Row
            label={isFixture ? 'Messages in the slice' : 'Messages going out'}
            value={prepared.messagesSent.toLocaleString('en-US')}
            suffix={`of ${prepared.sample.totalAvailable.toLocaleString('en-US')} (${pctOfChat}%)`}
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
            value={isFixture ? 'nobody — just your device' : 'an AI (Anthropic Claude)'}
            suffix={isFixture ? 'in test mode everything stays local' : 'stored up to 30 days, does NOT train on your data'}
          />
          <Row
            label="Costs"
            value={`${cost} ticket`}
            suffix={`You have ${balance} · each analysis = 1 ticket`}
          />
        </div>

        {/* Trust reassurance — plain language */}
        <div className="bg-bg-surface/60 border border-line/60 rounded-xl p-5 mb-10">
          <div className="label-mono mb-3 text-b">What Decode never does</div>
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

        {insufficient && (
          <div className="card border-b/60 bg-b/5 mb-6">
            <div className="label-mono text-b mb-2">Out of tickets</div>
            <p className="serif-body text-lg text-ink mb-4">
              "{meta.label}" needs {cost} {cost === 1 ? 'ticket' : 'tickets'} — you have {balance} right now.
            </p>
            {onOpenTokens && (
              <button
                onClick={onOpenTokens}
                className="px-5 py-2.5 bg-b text-bg rounded-full font-sans text-sm tracking-wide hover:bg-b/90 transition-colors"
              >
                Top up tickets →
              </button>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAccept}
            disabled={insufficient}
            className="flex-1 btn-pop px-6 py-4 text-base"
          >
            <span aria-hidden>✨</span>
            Start the analysis
            <span className="label-mono ml-1 text-bg/70">
              {cost} {cost === 1 ? 'ticket' : 'tickets'}
            </span>
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border border-line rounded-full font-sans font-medium text-base text-ink-muted hover:border-ink hover:text-ink hover:bg-bg-raised/40 transition-all"
          >
            Back to the numbers
          </button>
        </div>

        <p className="text-ink-faint text-[11px] font-mono mt-6 leading-relaxed">
          Hitting "Start the analysis" confirms: the chat is yours or you were part of it. No strangers' chats, please.
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
