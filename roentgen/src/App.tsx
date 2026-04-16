import { useMemo, useState } from 'react'
import { parseWhatsApp } from './parser/whatsapp'
import type { ParsedChat } from './parser/types'
import { analyzeHardFacts } from './analysis/hardFacts'
import { Upload } from './components/Upload'
import { ParsingAnimation } from './components/ParsingAnimation'
import { HardFactsView } from './components/HardFactsView'
import { NetworkIndicator, type NetworkMode } from './components/NetworkIndicator'
import { ConsentScreen } from './components/ConsentScreen'
import { AiProgress } from './components/AiProgress'
import { ProfileView } from './components/ProfileView'
import { prepareAnalysis, runProfileAnalyses, type PrepareResult } from './ai/profile'
import { runHighlights } from './ai/highlights'
import { runRelationshipAnalysis } from './ai/relationship'
import { runTimeline } from './ai/timeline'
import { runEntwicklung } from './ai/entwicklung'
import { buildSymmetryTrend } from './analysis/symmetryTrend'
import { HighlightsView } from './components/HighlightsView'
import { RelationshipView } from './components/RelationshipView'
import { TimelineView } from './components/TimelineView'
import { EntwicklungView } from './components/EntwicklungView'
import { TokenBadge } from './components/TokenBadge'
import { TokenOverview } from './components/TokenOverview'
import { tokenStore, type ModuleId } from './tokens/store'
import type {
  EntwicklungResult,
  HighlightsResult,
  ProfileResult,
  RelationshipResult,
  TimelineResult,
} from './ai/types'

type Stage =
  | 'upload'
  | 'parsing'
  | 'analysis'
  | 'consent'
  | 'ai'
  | 'profiles'
  | 'relationship_loading'
  | 'relationship'
  | 'highlights_loading'
  | 'highlights'
  | 'timeline_loading'
  | 'timeline'
  | 'entwicklung_loading'
  | 'entwicklung'
  | 'tokens'

function App() {
  const [stage, setStage] = useState<Stage>('upload')
  const [chat, setChat] = useState<ParsedChat | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const [prepared, setPrepared] = useState<PrepareResult | null>(null)
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number; current: string | null }>({
    done: 0,
    total: 0,
    current: null,
  })
  const [aiError, setAiError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<ProfileResult[] | null>(null)
  const [highlights, setHighlights] = useState<HighlightsResult | null>(null)
  const [highlightsError, setHighlightsError] = useState<string | null>(null)
  const [relationship, setRelationship] = useState<RelationshipResult | null>(null)
  const [relationshipError, setRelationshipError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineResult | null>(null)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [entwicklung, setEntwicklung] = useState<EntwicklungResult | null>(null)
  const [entwicklungError, setEntwicklungError] = useState<string | null>(null)
  const [tokensReturnTo, setTokensReturnTo] = useState<Stage>('upload')
  const [tokensPrompt, setTokensPrompt] = useState<{ module: ModuleId } | null>(null)

  const openTokens = (returnTo: Stage, prompt?: { module: ModuleId }) => {
    setTokensReturnTo(returnTo)
    setTokensPrompt(prompt ?? null)
    setStage('tokens')
  }

  const facts = useMemo(() => {
    if (!chat || chat.messages.length === 0) return null
    try {
      return analyzeHardFacts(chat)
    } catch (e) {
      console.error(e)
      return null
    }
  }, [chat])

  const networkMode: NetworkMode =
    stage === 'ai' ||
    stage === 'highlights_loading' ||
    stage === 'relationship_loading' ||
    stage === 'timeline_loading' ||
    stage === 'entwicklung_loading'
      ? 'ai'
      : stage === 'profiles' ||
          stage === 'highlights' ||
          stage === 'relationship' ||
          stage === 'timeline' ||
          stage === 'entwicklung'
        ? 'done'
        : 'local'

  const handleFile = (text: string, name: string) => {
    setParseError(null)
    setFileName(name)
    const parsed = parseWhatsApp(text)
    if (parsed.messages.length === 0) {
      setParseError(parsed.warnings[0] ?? 'Keine Nachrichten erkannt.')
      return
    }
    setChat(parsed)
    setStage('parsing')
  }

  const reset = () => {
    setStage('upload')
    setChat(null)
    setFileName(null)
    setParseError(null)
    setPrepared(null)
    setProfiles(null)
    setHighlights(null)
    setHighlightsError(null)
    setRelationship(null)
    setRelationshipError(null)
    setTimeline(null)
    setTimelineError(null)
    setEntwicklung(null)
    setEntwicklungError(null)
    setAiError(null)
    setAiProgress({ done: 0, total: 0, current: null })
  }

  const startAiAnalysis = () => {
    if (!chat) return
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  const runAi = async () => {
    if (!chat || !prepared) return
    if (!tokenStore.charge('profiles')) {
      openTokens('consent', { module: 'profiles' })
      return
    }
    setAiError(null)
    setAiProgress({ done: 0, total: chat.participants.length, current: chat.participants[0] })
    setStage('ai')
    try {
      const results = await runProfileAnalyses({
        chat,
        prepared,
        onProgress: (done, total, current) => setAiProgress({ done, total, current }),
      })
      setProfiles(results)
      setStage('profiles')
    } catch (e) {
      const err = e as Error
      tokenStore.refund('profiles')
      setAiError(err.message ?? 'Analyse fehlgeschlagen.')
    }
  }

  const goToHighlights = async () => {
    if (!chat || !prepared) return
    if (highlights) {
      setStage('highlights')
      return
    }
    if (!tokenStore.charge('highlights')) {
      openTokens('profiles', { module: 'highlights' })
      return
    }
    setHighlightsError(null)
    setStage('highlights_loading')
    try {
      const result = await runHighlights({ chat, prepared })
      setHighlights(result)
      setStage('highlights')
    } catch (e) {
      const err = e as Error
      tokenStore.refund('highlights')
      setHighlightsError(err.message ?? 'Highlights-Analyse fehlgeschlagen.')
    }
  }

  const goToRelationship = async () => {
    if (!chat || !prepared) return
    if (relationship) {
      setStage('relationship')
      return
    }
    if (!tokenStore.charge('relationship')) {
      openTokens('profiles', { module: 'relationship' })
      return
    }
    setRelationshipError(null)
    setStage('relationship_loading')
    try {
      const result = await runRelationshipAnalysis({ chat, prepared })
      setRelationship(result)
      setStage('relationship')
    } catch (e) {
      const err = e as Error
      tokenStore.refund('relationship')
      setRelationshipError(err.message ?? 'Beziehungsebene-Analyse fehlgeschlagen.')
    }
  }

  const goToTimeline = async () => {
    if (!chat || !prepared) return
    if (timeline) {
      setStage('timeline')
      return
    }
    if (!tokenStore.charge('timeline')) {
      openTokens('profiles', { module: 'timeline' })
      return
    }
    setTimelineError(null)
    setStage('timeline_loading')
    try {
      const result = await runTimeline({ chat, prepared })
      setTimeline(result)
      setStage('timeline')
    } catch (e) {
      const err = e as Error
      tokenStore.refund('timeline')
      setTimelineError(err.message ?? 'Timeline-Analyse fehlgeschlagen.')
    }
  }

  const goToEntwicklung = async () => {
    if (!chat || !prepared || !facts) return
    if (entwicklung) {
      setStage('entwicklung')
      return
    }
    if (!tokenStore.charge('entwicklung')) {
      openTokens('profiles', { module: 'entwicklung' })
      return
    }
    setEntwicklungError(null)
    setStage('entwicklung_loading')
    try {
      const symmetry = buildSymmetryTrend(facts)
      const result = await runEntwicklung({ chat, prepared, symmetry })
      setEntwicklung(result)
      setStage('entwicklung')
    } catch (e) {
      const err = e as Error
      tokenStore.refund('entwicklung')
      setEntwicklungError(err.message ?? 'Entwicklungs-Analyse fehlgeschlagen.')
    }
  }

  return (
    <div className="min-h-screen grain bg-bg text-ink">
      <header className="sticky top-0 z-40 bg-bg/70 backdrop-blur-xl border-b border-line/40">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <button onClick={reset} className="flex items-baseline gap-3 group">
            <span className="font-serif text-2xl tracking-tight group-hover:text-a transition-colors">Röntgen</span>
            <span className="label-mono text-ink-faint hidden md:inline">Chat · psychologisch dekodiert</span>
          </button>
          <div className="flex items-center gap-3">
            {stage === 'profiles' && (
              <>
                <button
                  onClick={() => setStage('analysis')}
                  className="label-mono text-ink-muted hover:text-ink transition-colors hidden md:inline"
                >
                  ← Hard Facts
                </button>
                <button
                  onClick={goToRelationship}
                  className="label-mono text-a hover:text-ink transition-colors hidden md:inline"
                >
                  Beziehungsebene →
                </button>
                <button
                  onClick={goToHighlights}
                  className="label-mono text-b hover:text-ink transition-colors hidden md:inline"
                >
                  Highlights →
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="label-mono text-a hover:text-ink transition-colors hidden md:inline"
                >
                  Entwicklung →
                </button>
                <button
                  onClick={goToTimeline}
                  className="label-mono text-ink hover:text-a transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'relationship' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="label-mono text-ink-muted hover:text-ink transition-colors hidden md:inline"
                >
                  ← Profile
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="label-mono text-a hover:text-ink transition-colors hidden md:inline"
                >
                  Entwicklung →
                </button>
                <button
                  onClick={goToHighlights}
                  className="label-mono text-b hover:text-ink transition-colors hidden md:inline"
                >
                  Highlights →
                </button>
                <button
                  onClick={goToTimeline}
                  className="label-mono text-ink hover:text-a transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'highlights' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="label-mono text-ink-muted hover:text-ink transition-colors hidden md:inline"
                >
                  ← Profile
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="label-mono text-a hover:text-ink transition-colors hidden md:inline"
                >
                  Entwicklung →
                </button>
                <button
                  onClick={goToTimeline}
                  className="label-mono text-ink hover:text-a transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'entwicklung' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="label-mono text-ink-muted hover:text-ink transition-colors hidden md:inline"
                >
                  ← Profile
                </button>
                <button
                  onClick={goToTimeline}
                  className="label-mono text-ink hover:text-a transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'timeline' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="label-mono text-ink-muted hover:text-ink transition-colors hidden md:inline"
                >
                  ← Profile
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="label-mono text-a hover:text-ink transition-colors hidden md:inline"
                >
                  Entwicklung →
                </button>
              </>
            )}
            <NetworkIndicator
              mode={networkMode}
              detail={
                (stage === 'ai' ||
                  stage === 'highlights_loading' ||
                  stage === 'relationship_loading' ||
                  stage === 'timeline_loading' ||
                  stage === 'entwicklung_loading') &&
                prepared
                  ? prepared.analyzerKind === 'fixture'
                    ? 'Fixture-Mode · nichts wird gesendet'
                    : `${prepared.messagesSent} Nachrichten · pseudonymisiert`
                  : undefined
              }
            />
            <TokenBadge onClick={() => openTokens(stage === 'tokens' ? tokensReturnTo : stage)} />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {stage === 'upload' && (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-5 md:px-8 py-12">
            <div className="w-full">
              <Upload onFile={handleFile} />
              {parseError && (
                <div className="mt-8 max-w-2xl mx-auto card border-b/50">
                  <div className="label-mono text-b mb-2">Parsing fehlgeschlagen</div>
                  <p className="serif-body text-lg">{parseError}</p>
                  {fileName && <div className="label-mono mt-3">Datei: {fileName}</div>}
                </div>
              )}
              <PrivacyStripe />
            </div>
          </div>
        )}

        {stage === 'parsing' && chat && (
          <ParsingAnimation chat={chat} onDone={() => setStage('analysis')} />
        )}

        {stage === 'analysis' && facts && (
          <HardFactsView
            facts={facts}
            onStartAi={startAiAnalysis}
            onOpenTokens={() => openTokens('analysis')}
          />
        )}

        {stage === 'consent' && chat && prepared && (
          <ConsentScreen
            chat={chat}
            prepared={prepared}
            onAccept={runAi}
            onCancel={() => setStage('analysis')}
            onOpenTokens={() => openTokens('consent', { module: 'profiles' })}
          />
        )}

        {stage === 'ai' && (
          <AiProgress
            done={aiProgress.done}
            total={aiProgress.total}
            currentPerson={aiProgress.current}
            error={aiError}
            onCancel={aiError ? () => setStage('analysis') : undefined}
          />
        )}

        {stage === 'profiles' && profiles && (
          <ProfileView
            profiles={profiles}
            onGoToRelationship={goToRelationship}
            onGoToHighlights={goToHighlights}
          />
        )}

        {stage === 'relationship_loading' && (
          <AiProgress
            done={relationshipError ? 0 : 1}
            total={2}
            currentPerson={relationshipError ? null : 'Dynamik dekodieren'}
            error={relationshipError}
            onCancel={relationshipError ? () => setStage('profiles') : undefined}
          />
        )}

        {stage === 'relationship' && relationship && chat && (
          <RelationshipView
            result={relationship}
            participants={chat.participants}
            onBack={() => setStage('profiles')}
          />
        )}

        {stage === 'highlights_loading' && (
          <AiProgress
            done={highlightsError ? 0 : 1}
            total={2}
            currentPerson={highlightsError ? null : 'Momente ranken'}
            error={highlightsError}
            onCancel={highlightsError ? () => setStage('profiles') : undefined}
          />
        )}

        {stage === 'highlights' && highlights && chat && (
          <HighlightsView result={highlights} participants={chat.participants} />
        )}

        {stage === 'timeline_loading' && (
          <AiProgress
            done={timelineError ? 0 : 1}
            total={2}
            currentPerson={timelineError ? null : 'Bogen segmentieren'}
            error={timelineError}
            onCancel={timelineError ? () => setStage('profiles') : undefined}
          />
        )}

        {stage === 'timeline' && timeline && facts && (
          <TimelineView timeline={timeline} facts={facts} highlights={highlights} />
        )}

        {stage === 'entwicklung_loading' && (
          <AiProgress
            done={entwicklungError ? 0 : 1}
            total={2}
            currentPerson={entwicklungError ? null : 'Themen & Trend'}
            error={entwicklungError}
            onCancel={entwicklungError ? () => setStage('profiles') : undefined}
          />
        )}

        {stage === 'entwicklung' && entwicklung && facts && (
          <EntwicklungView result={entwicklung} facts={facts} />
        )}

        {stage === 'tokens' && (
          <TokenOverview
            onClose={() => {
              setTokensPrompt(null)
              setStage(tokensReturnTo)
            }}
            highlightReason={tokensPrompt ? 'insufficient' : null}
            pendingModule={tokensPrompt?.module ?? null}
          />
        )}

        {stage === 'analysis' && !facts && (
          <div className="max-w-2xl mx-auto p-12 text-center">
            <p className="serif-body text-xl">Analyse fehlgeschlagen. Versuche einen anderen Chat.</p>
            <button onClick={reset} className="mt-6 px-5 py-3 bg-ink text-bg rounded-full font-sans text-sm">
              Neu starten
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-line/40 mt-20 py-10 px-5 md:px-8 text-center">
        <div className="label-mono text-ink-faint">
          Röntgen · made for the things you don't say out loud
        </div>
      </footer>
    </div>
  )
}

function PrivacyStripe() {
  return (
    <div className="mt-16 max-w-3xl mx-auto grid md:grid-cols-3 gap-4 text-center">
      {[
        { icon: '●', title: 'Lokal', body: 'Parser und Basisanalyse laufen im Browser. Kein Upload.' },
        { icon: '◇', title: 'Kein Account', body: 'Keine E-Mail, kein Passwort. Nur du und die Datei.' },
        { icon: '✕', title: 'Kein Speichern', body: 'Tab zu = weg. Wir sehen den Chat nie.' },
      ].map((p) => (
        <div key={p.title} className="bg-bg-raised/40 border border-line/40 rounded-xl p-5">
          <div className="text-a mb-2 text-lg">{p.icon}</div>
          <div className="label-mono mb-2">{p.title}</div>
          <div className="serif-body text-base text-ink-muted">{p.body}</div>
        </div>
      ))}
    </div>
  )
}

export default App
