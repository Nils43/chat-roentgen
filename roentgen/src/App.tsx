import { useEffect, useMemo, useState } from 'react'
import { loadSession, saveSession } from './store/sessionStore'
import { chatLibrary, useChatLibrary } from './store/chatLibrary'
import { Library } from './components/Library'
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
  | 'intro'
  | 'library'
  | 'upload'
  | 'parsing'
  | 'analysis'
  | 'self_pick'
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
  const library = useChatLibrary()
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>(library.length > 0 ? 'library' : 'upload')
  const finishIntro = () => setStage(library.length > 0 ? 'library' : 'upload')
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

  useEffect(() => {
    if (!currentChatId || !chat) return
    const snap = {
      fileName,
      chat,
      prepared,
      profiles,
      relationship,
      highlights,
      timeline,
      entwicklung,
    }
    void saveSession(currentChatId, snap)
    chatLibrary.syncModules(currentChatId, snap)
  }, [currentChatId, fileName, chat, prepared, profiles, relationship, highlights, timeline, entwicklung])
  const [tokensReturnTo, setTokensReturnTo] = useState<Stage>('upload')
  const [tokensPrompt, setTokensPrompt] = useState<{ module: ModuleId } | null>(null)
  const [pendingModule, setPendingModule] = useState<ModuleId>('profiles')

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
      console.error('[analyzeHardFacts]', e)
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

  const handleFile = async (text: string, name: string) => {
    setParseError(null)
    const parsed = parseWhatsApp(text)
    if (parsed.messages.length === 0) {
      setParseError(parsed.warnings[0] ?? 'no messages found — hmm.')
      return
    }
    const meta = chatLibrary.create(parsed, name)
    const ok = await saveSession(meta.id, {
      fileName: name,
      chat: parsed,
      prepared: null,
      profiles: null,
      relationship: null,
      highlights: null,
      timeline: null,
      entwicklung: null,
    })
    if (!ok) {
      chatLibrary.remove(meta.id)
      const sizeMb = (text.length / 1024 / 1024).toFixed(1)
      setParseError(
        `your chat is ~${sizeMb} MB — that's too big to stash on this device. export a shorter slice — like just the last few months.`,
      )
      return
    }
    clearLocalState()
    setCurrentChatId(meta.id)
    setFileName(name)
    setChat(parsed)
    setStage('parsing')
  }

  const clearLocalState = () => {
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

  const openChat = async (id: string) => {
    const snap = await loadSession(id)
    if (!snap?.chat) {
      alert(
        "this chat isn't on your device anymore — probably deleted or too big. kicking the card.",
      )
      chatLibrary.remove(id)
      return
    }
    clearLocalState()
    setCurrentChatId(id)
    setChat(snap.chat)
    setFileName(snap.fileName ?? null)
    setPrepared(snap.prepared ?? null)
    setProfiles(snap.profiles ?? null)
    setRelationship(snap.relationship ?? null)
    setHighlights(snap.highlights ?? null)
    setTimeline(snap.timeline ?? null)
    setEntwicklung(snap.entwicklung ?? null)
    setStage('analysis')
  }

  const goToLibrary = () => {
    clearLocalState()
    setCurrentChatId(null)
    setChat(null)
    setFileName(null)
    setStage(chatLibrary.get().length > 0 ? 'library' : 'upload')
  }

  const startNewChat = () => {
    clearLocalState()
    setCurrentChatId(null)
    setChat(null)
    setFileName(null)
    setStage('upload')
  }

  const reset = goToLibrary

  const startAiAnalysis = () => {
    if (!chat) return
    setPendingModule('profiles')
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    if (!meta?.selfPerson) {
      setStage('self_pick')
      return
    }
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  const confirmSelfPerson = (person: string) => {
    if (!currentChatId || !chat) return
    chatLibrary.setSelf(currentChatId, person)
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  // Direct module click from HardFactsView. If we haven't shown consent yet,
  // show it with the chosen module as pending target. If prepared exists,
  // skip the consent and dispatch to the specific runner.
  const startModule = (moduleId: ModuleId) => {
    if (!chat) return
    // If a result for this module already exists, navigate there
    const existingStage: Record<ModuleId, Stage> = {
      profiles: 'profiles',
      relationship: 'relationship',
      entwicklung: 'entwicklung',
      highlights: 'highlights',
      timeline: 'timeline',
    }
    const existingResult: Record<ModuleId, unknown> = {
      profiles: profiles,
      relationship: relationship,
      entwicklung: entwicklung,
      highlights: highlights,
      timeline: timeline,
    }
    if (existingResult[moduleId]) {
      setStage(existingStage[moduleId])
      return
    }

    setPendingModule(moduleId)
    if (!prepared) {
      const p = prepareAnalysis(chat)
      setPrepared(p)
      setStage('consent')
      return
    }
    dispatchModule(moduleId)
  }

  // Runs the specific module runner. Callers must have `prepared` set.
  const dispatchModule = (moduleId: ModuleId) => {
    switch (moduleId) {
      case 'profiles':
        return runAi()
      case 'highlights':
        return goToHighlights()
      case 'relationship':
        return goToRelationship()
      case 'entwicklung':
        return goToEntwicklung()
      case 'timeline':
        return goToTimeline()
    }
  }

  // Consent screen's accept handler: dispatch to whichever module was pending.
  const onConsentAccept = () => dispatchModule(pendingModule)

  const runAi = async () => {
    if (!chat || !prepared) return
    // Only the user themselves is profiled — the other person has not
    // consented to be psychologically analyzed.
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    const selfPerson = meta?.selfPerson ?? chat.participants[0]
    if (!selfPerson) return
    setAiError(null)
    setAiProgress({ done: 0, total: 1, current: selfPerson })
    setStage('ai')
    try {
      const results = await runProfileAnalyses({
        chat,
        prepared,
        targetPersons: [selfPerson],
        onProgress: (done, total, current) => setAiProgress({ done, total, current }),
      })
      setProfiles(results)
      setStage('profiles')
    } catch (e) {
      const err = e as Error
      setAiError(err.message ?? 'analysis failed.')
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
      setHighlightsError(err.message ?? 'highlights failed.')
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
      setRelationshipError(err.message ?? 'vibe read failed.')
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
      setTimelineError(err.message ?? 'timeline failed.')
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
      setEntwicklungError(err.message ?? 'evolution read failed.')
    }
  }

  // Tab mapping for the bottom-nav (LEAKS / INTEL / FILES / STATS)
  const currentTab: 'leaks' | 'intel' | 'files' | 'stats' =
    stage === 'library' || stage === 'upload' || stage === 'parsing'
      ? 'leaks'
      : stage === 'analysis' || stage === 'consent' || stage === 'ai'
        ? 'intel'
        : stage === 'tokens'
          ? 'stats'
          : 'files'

  return (
    <div className="min-h-screen bg-bg text-ink pb-20">
      <header className="sticky top-0 z-40 bg-black text-white border-b-2 border-ink">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-4">
          <button onClick={goToLibrary} className="flex items-baseline gap-2 group">
            <span className="font-serif italic text-2xl tracking-tight text-white group-hover:text-yellow-300 transition-colors">tea</span>
            <span className="bg-pop-yellow text-ink px-1.5 leading-none text-2xl font-serif">.</span>
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 ml-3">· local only</span>
          </button>
          <div className="flex items-center gap-3 text-white">
            {currentChatId && stage !== 'library' && stage !== 'tokens' && (
              <button
                onClick={goToLibrary}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
              >
                ← back to leaks
              </button>
            )}
            {stage === 'profiles' && (
              <>
                <button
                  onClick={() => setStage('analysis')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  ← Hard Facts
                </button>
                <button
                  onClick={goToRelationship}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                >
                  Vibe read →
                </button>
                <button
                  onClick={goToHighlights}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Highlights →
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                >
                  Evolution →
                </button>
                <button
                  onClick={goToTimeline}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'relationship' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  ← Profiles
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                >
                  Evolution →
                </button>
                <button
                  onClick={goToHighlights}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Highlights →
                </button>
                <button
                  onClick={goToTimeline}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'highlights' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  ← Profiles
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                >
                  Evolution →
                </button>
                <button
                  onClick={goToTimeline}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'entwicklung' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  ← Profiles
                </button>
                <button
                  onClick={goToTimeline}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  Timeline →
                </button>
              </>
            )}
            {stage === 'timeline' && (
              <>
                <button
                  onClick={() => setStage('profiles')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  ← Profiles
                </button>
                <button
                  onClick={goToEntwicklung}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                >
                  Evolution →
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
                    ? 'test mode · nothing gets sent'
                    : `${prepared.messagesSent} messages · names hidden`
                  : undefined
              }
            />
            <TokenBadge onClick={() => openTokens(stage === 'tokens' ? tokensReturnTo : stage)} />
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {stage === 'intro' && <TeaIntro onDone={finishIntro} />}

        {stage === 'library' && <Library onOpen={openChat} onNew={startNewChat} />}

        {stage === 'upload' && (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-5 md:px-8 py-12">
            <div className="w-full">
              {library.length > 0 && (
                <div className="max-w-2xl mx-auto mb-6">
                  <button
                    onClick={() => setStage('library')}
                    className="label-mono text-ink-faint hover:text-ink transition-colors"
                  >
                    ← back to library
                  </button>
                </div>
              )}
              <Upload onFile={handleFile} />
              {parseError && (
                <div className="mt-8 max-w-2xl mx-auto card border-b/50">
                  <div className="label-mono text-b mb-2">something broke</div>
                  <p className="serif-body text-lg">{parseError}</p>
                  {fileName && <div className="label-mono mt-3">file: {fileName}</div>}
                </div>
              )}
              <PrivacyStripe />
            </div>
          </div>
        )}

        {stage === 'parsing' && chat && (
          <ParsingAnimation chat={chat} onDone={() => setStage('analysis')} />
        )}

        {stage === 'analysis' && facts && (() => {
          const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
          const hfMode: 'exhibit' | 'scroll' = meta?.exhibitSeen ? 'scroll' : 'exhibit'
          return (
            <HardFactsView
              facts={facts}
              onStartAi={startAiAnalysis}
              onStartModule={startModule}
              onOpenTokens={() => openTokens('analysis')}
              mode={hfMode}
              onExhibitComplete={() => {
                if (currentChatId) chatLibrary.markExhibitSeen(currentChatId)
              }}
            />
          )
        })()}

        {stage === 'self_pick' && chat && (
          <SelfPick
            participants={chat.participants}
            onPick={confirmSelfPerson}
            onCancel={() => setStage('analysis')}
          />
        )}

        {stage === 'consent' && chat && prepared && (
          <ConsentScreen
            chat={chat}
            prepared={prepared}
            moduleId={pendingModule}
            onAccept={onConsentAccept}
            onCancel={() => setStage('analysis')}
            onOpenTokens={() => openTokens('consent', { module: pendingModule })}
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
            chatId={currentChatId}
            onGoToRelationship={goToRelationship}
            onGoToHighlights={goToHighlights}
            onOpenTokens={() => openTokens('profiles', { module: 'profiles' })}
          />
        )}

        {stage === 'relationship_loading' && (
          <AiProgress
            done={relationshipError ? 0 : 1}
            total={2}
            currentPerson={relationshipError ? null : 'reading the dynamic'}
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
            currentPerson={highlightsError ? null : 'ranking the moments'}
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
            currentPerson={timelineError ? null : 'mapping the arc'}
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
            currentPerson={entwicklungError ? null : 'topics & trend'}
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
            <p className="serif-body text-xl">analysis crashed. try a different chat.</p>
            <button onClick={reset} className="mt-6 px-5 py-3 bg-ink text-bg rounded-full font-sans text-sm">
              try again
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black text-white border-t-2 border-ink">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex gap-4 md:gap-6 items-center font-mono text-[10px] md:text-[11px] tracking-[0.16em] uppercase">
            <button
              onClick={goToLibrary}
              className={`flex items-center gap-1.5 transition-colors ${currentTab === 'leaks' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4 L14 4 L13 13 L3 13 Z M5 4 V2 L11 2 V4"/></svg>
              leaks
            </button>
            <button
              onClick={() => chat && setStage('analysis')}
              disabled={!chat}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${currentTab === 'intel' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/></svg>
              intel
            </button>
            <button
              onClick={() => profiles && setStage('profiles')}
              disabled={!profiles && !relationship && !highlights && !timeline && !entwicklung}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${currentTab === 'files' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3 L7 3 L8 5 L14 5 L14 13 L2 13 Z"/></svg>
              files
            </button>
            <button
              onClick={() => openTokens(stage === 'tokens' ? tokensReturnTo : stage)}
              className={`flex items-center gap-1.5 transition-colors ${currentTab === 'stats' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 13 L2 8 M6 13 L6 5 M10 13 L10 9 M14 13 L14 3"/></svg>
              stats
            </button>
          </div>
          <div className="hidden md:block font-mono text-[10px] tracking-[0.14em] uppercase text-white/40">
            local · 24h delete · no account
          </div>
        </div>
      </nav>
    </div>
  )
}

function PrivacyStripe() {
  const items = [
    { title: 'EXHIBIT 01: ON-DEVICE', body: 'the first numbers are crunched by your phone or laptop — nothing gets uploaded.' },
    { title: 'EXHIBIT 02: NO ACCOUNT', body: 'no email, no password. just you and your chat.' },
    { title: 'EXHIBIT 03: NO READERS', body: 'neither we nor anyone else sees your chat. it stays with you.' },
  ]
  return (
    <div className="mt-16 max-w-3xl mx-auto grid md:grid-cols-3 gap-4">
      {items.map((p, i) => (
        <div
          key={p.title}
          className="card relative"
          style={{ transform: `rotate(${i === 0 ? -0.6 : i === 1 ? 0.4 : -0.3}deg)` }}
        >
          <span className="exhibit-label">{p.title}</span>
          <div className="serif-body text-base mt-2">{p.body}</div>
        </div>
      ))}
    </div>
  )
}

function TeaIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'tea-intro-done') onDone()
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onDone])
  return (
    <div className="fixed inset-0 z-[60] bg-bg">
      <iframe
        src="/prototypes/tea-exhibit.html?embed=1"
        title="tea · the tape"
        className="w-full h-full border-0"
      />
      <button
        onClick={onDone}
        className="absolute top-3 right-3 md:top-4 md:right-4 z-[70] font-mono text-[10px] tracking-[0.18em] uppercase text-ink hover:bg-white bg-white/80 border-2 border-ink px-3 py-1.5 transition-colors"
        style={{ boxShadow: '2px 2px 0 #0A0A0A' }}
        aria-label="Skip intro"
      >
        Skip →
      </button>
    </div>
  )
}

function SelfPick({
  participants,
  onPick,
  onCancel,
}: {
  participants: string[]
  onPick: (p: string) => void
  onCancel: () => void
}) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-5 md:px-8 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-3">
          <div className="label-mono text-ink/60">before we read</div>
          <h2 className="font-serif italic text-4xl md:text-5xl leading-tight text-ink">
            Which one is you<span className="bg-pop-yellow px-1">?</span>
          </h2>
          <p className="serif-body text-lg text-ink">
            I only profile you. The other person didn't agree to be read.
          </p>
        </div>

        <div className="space-y-3">
          {participants.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="btn-pop w-full justify-start text-left"
            >
              I am {p}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="label-mono text-ink/60 hover:text-ink transition-colors"
        >
          ← back
        </button>
      </div>
    </div>
  )
}

export default App
