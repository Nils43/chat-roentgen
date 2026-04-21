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
import { runRelationshipAnalysis } from './ai/relationship'
import { RelationshipView } from './components/RelationshipView'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { Imprint } from './components/Imprint'
import { Settings } from './components/Settings'
import { PrivacyBanner } from './components/PrivacyBanner'
import type { ModuleId } from './store/chatLibrary'
import type { ProfileResult, RelationshipResult } from './ai/types'

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
  | 'privacy'
  | 'imprint'
  | 'settings'

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
  const [relationship, setRelationship] = useState<RelationshipResult | null>(null)
  const [relationshipError, setRelationshipError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentChatId || !chat) return
    const snap = {
      fileName,
      chat,
      prepared,
      profiles,
      relationship,
    }
    void saveSession(currentChatId, snap)
    chatLibrary.syncModules(currentChatId, snap)
  }, [currentChatId, fileName, chat, prepared, profiles, relationship])

  // Deep-link: `?scroll=<chatId>` opens that chat straight into scroll view.
  // Data is local to each device, so this only resolves for chats the user
  // has previously stored on this browser — shared links across devices would
  // need a backend.
  useEffect(() => {
    const url = new URL(window.location.href)
    const sharedId = url.searchParams.get('scroll')
    if (!sharedId) return
    const meta = chatLibrary.getMeta(sharedId)
    if (!meta) return
    chatLibrary.markExhibitSeen(sharedId) // friend skips the click-through
    void openChat(sharedId)
    url.searchParams.delete('scroll')
    window.history.replaceState({}, '', url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [pendingModule, setPendingModule] = useState<ModuleId>('profiles')

  const facts = useMemo(() => {
    if (!chat || chat.messages.length === 0) return null
    try {
      return analyzeHardFacts(chat)
    } catch (e) {
      console.error('[analyzeHardFacts]', e)
      return null
    }
  }, [chat])

  // Relationship analysis is inherently pairwise. Group chats only get the
  // personal file.
  const canAnalyzeRelationship = (chat?.participants.length ?? 0) === 2

  const networkMode: NetworkMode =
    stage === 'ai' || stage === 'relationship_loading'
      ? 'ai'
      : stage === 'profiles' || stage === 'relationship'
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
    setRelationship(null)
    setRelationshipError(null)
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
    if (moduleId === 'relationship' && !canAnalyzeRelationship) return
    // If a result for this module already exists, navigate there
    const existingStage: Record<ModuleId, Stage> = {
      profiles: 'profiles',
      relationship: 'relationship',
    }
    const existingResult: Record<ModuleId, unknown> = {
      profiles: profiles,
      relationship: relationship,
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
      case 'relationship':
        return goToRelationship()
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

  const goToRelationship = async () => {
    if (!chat || !prepared) return
    if (!canAnalyzeRelationship) return
    if (relationship) {
      setStage('relationship')
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
      setRelationshipError(err.message ?? 'vibe read failed.')
    }
  }

  // Tab mapping for the bottom-nav (LEAKS / INTEL / FILES)
  const currentTab: 'leaks' | 'intel' | 'files' =
    stage === 'library' || stage === 'upload' || stage === 'parsing'
      ? 'leaks'
      : stage === 'analysis' || stage === 'consent' || stage === 'ai'
        ? 'intel'
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
            {currentChatId && stage !== 'library' && (
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
                {canAnalyzeRelationship && (
                  <button
                    onClick={goToRelationship}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                  >
                    Relationship →
                  </button>
                )}
              </>
            )}
            {stage === 'relationship' && (
              <button
                onClick={() => setStage('profiles')}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
              >
                ← Personal
              </button>
            )}
            <NetworkIndicator
              mode={networkMode}
              detail={
                (stage === 'ai' || stage === 'relationship_loading') &&
                prepared
                  ? prepared.analyzerKind === 'fixture'
                    ? 'test mode · nothing gets sent'
                    : `${prepared.messagesSent} messages · names hidden`
                  : undefined
              }
            />
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
              chatId={currentChatId}
              onStartAi={startAiAnalysis}
              onStartModule={startModule}
              canAnalyzeRelationship={canAnalyzeRelationship}
              mode={hfMode}
              completedModules={[
                profiles ? ('profiles' as const) : null,
                relationship ? ('relationship' as const) : null,
              ].filter((m): m is ModuleId => m !== null)}
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

        {stage === 'analysis' && !facts && (
          <div className="max-w-2xl mx-auto p-12 text-center">
            <p className="serif-body text-xl">analysis crashed. try a different chat.</p>
            <button onClick={reset} className="mt-6 px-5 py-3 bg-ink text-bg rounded-full font-sans text-sm">
              try again
            </button>
          </div>
        )}

        {stage === 'privacy' && (
          <PrivacyPolicy onBack={() => setStage(library.length > 0 ? 'library' : 'upload')} />
        )}
        {stage === 'imprint' && (
          <Imprint onBack={() => setStage(library.length > 0 ? 'library' : 'upload')} />
        )}
        {stage === 'settings' && (
          <Settings
            onBack={() => setStage(library.length > 0 ? 'library' : 'upload')}
            onOpenPrivacy={() => setStage('privacy')}
            onOpenImprint={() => setStage('imprint')}
          />
        )}
      </main>

      {/* First-visit privacy banner */}
      {stage !== 'privacy' && stage !== 'imprint' && stage !== 'settings' && (
        <PrivacyBanner onReadPolicy={() => setStage('privacy')} />
      )}

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
              disabled={!profiles && !relationship}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${currentTab === 'files' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3 L7 3 L8 5 L14 5 L14 13 L2 13 Z"/></svg>
              files
            </button>
          </div>
          <div className="flex items-center gap-3 md:gap-5 font-mono text-[10px] tracking-[0.14em] uppercase">
            <button
              onClick={() => setStage('settings')}
              className="text-white/50 hover:text-pop-yellow transition-colors"
            >
              settings
            </button>
            <button
              onClick={() => setStage('privacy')}
              className="text-white/50 hover:text-pop-yellow transition-colors"
            >
              privacy
            </button>
            <button
              onClick={() => setStage('imprint')}
              className="text-white/50 hover:text-pop-yellow transition-colors hidden md:inline"
            >
              imprint
            </button>
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
