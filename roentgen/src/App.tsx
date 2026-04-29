import { useEffect, useMemo, useState } from 'react'
import { loadSession, saveSession } from './store/sessionStore'
import { chatLibrary, useChatLibrary } from './store/chatLibrary'
import { Library } from './components/Library'
import { parseWhatsApp } from './parser/whatsapp'
import { inferSelfPerson } from './parser/inferSelf'
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
import { t, useLocale } from './i18n'
import type { ModuleId } from './store/chatLibrary'
import type { ProfileResult, RelationshipResult } from './ai/types'
import { CheckoutModal, getStripe } from './components/CheckoutModal'
import { CreditsBadge } from './components/CreditsBadge'
import { CreditsPage } from './components/CreditsPage'
import { KeepCreditsModal } from './components/KeepCreditsModal'
import { useSession, signInWithGoogle } from './auth/useSession'
import { useCredits } from './credits/useCredits'
import { startPackCheckout } from './credits/client'
import type { Pack } from './credits/packs'
import { track } from './analytics/posthog'

type Stage =
  | 'intro'
  | 'library'
  | 'upload'
  | 'parsing'
  | 'analysis'
  | 'consent'
  | 'ai'
  | 'profiles'
  | 'relationship_loading'
  | 'relationship'
  | 'credits'
  | 'privacy'
  | 'imprint'
  | 'settings'

function App() {
  const library = useChatLibrary()
  const locale = useLocale()
  const { session } = useSession()
  const { balance, refresh: refreshCredits } = useCredits()
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>(library.length > 0 ? 'library' : 'upload')
  const finishIntro = () => setStage(library.length > 0 ? 'library' : 'upload')

  // PostHog: every stage change is a funnel step. Drop-off shows up as
  // "users hit `parsing` but never reached `analysis`" etc. No PII —
  // `stage` is a closed enum.
  useEffect(() => {
    track('app_view', { stage })
  }, [stage])
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

  // Active Stripe embedded-checkout session for a credit pack.
  const [checkout, setCheckout] = useState<{ clientSecret: string } | null>(null)
  // Post-purchase "save your credits" prompt — only for anonymous buyers.
  const [showKeepPrompt, setShowKeepPrompt] = useState(false)
  // UI-level "opening checkout…" / "confirming…" overlays.
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  // Soft error banner for payment hiccups.
  const [payError, setPayError] = useState<string | null>(null)
  const [pendingModule, setPendingModule] = useState<ModuleId>('profiles')

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
  useEffect(() => {
    const url = new URL(window.location.href)
    const sharedId = url.searchParams.get('scroll')
    if (!sharedId) return
    const meta = chatLibrary.getMeta(sharedId)
    if (!meta) return
    chatLibrary.markExhibitSeen(sharedId)
    void openChat(sharedId)
    url.searchParams.delete('scroll')
    window.history.replaceState({}, '', url.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-warm Stripe.js at app start.
  useEffect(() => {
    void getStripe()
  }, [])

  // Recovery: localStorage sometimes gets wiped by Safari ITP or by users
  // clearing "site data" — but the actual chat snapshots live in IndexedDB
  // which survives both. If the library index is empty on load, scan IDB for
  // orphaned sessions and rebuild the index.
  useEffect(() => {
    void chatLibrary.recoverFromSessions().then((n) => {
      if (n > 0 && import.meta.env.DEV) {
        console.log(`[chatLibrary] recovered ${n} chat(s) from IndexedDB`)
      }
    })
  }, [])

  // --- URL routing for the static stages (credits / legal / settings) ---
  // Internal wizard stages (parsing → ai → profiles …) stay state-only because
  // they carry too much transient state to survive a refresh, and each one
  // has no sensible URL. Only the stages a user might bookmark or share
  // get a route.
  useEffect(() => {
    const stageFromPath = (p: string): Stage | null => {
      if (p === '/credits') return 'credits'
      if (p === '/privacy') return 'privacy'
      if (p === '/imprint') return 'imprint'
      if (p === '/settings') return 'settings'
      return null
    }
    // Initial read — if user opens /credits directly, land there.
    const initial = stageFromPath(window.location.pathname)
    if (initial) setStage(initial)
    // Browser back/forward.
    const onPop = () => {
      const s = stageFromPath(window.location.pathname)
      if (s) setStage(s)
      else setStage(chatLibrary.get().length > 0 ? 'library' : 'upload')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push URL when we enter (or leave) a routable stage.
  useEffect(() => {
    const pathFromStage = (s: Stage): string | null => {
      if (s === 'credits') return '/credits'
      if (s === 'privacy') return '/privacy'
      if (s === 'imprint') return '/imprint'
      if (s === 'settings') return '/settings'
      return null
    }
    const stagePath = pathFromStage(stage)
    const current = window.location.pathname
    if (stagePath && current !== stagePath) {
      window.history.pushState(null, '', stagePath)
    } else if (!stagePath && current !== '/' && ['/credits', '/privacy', '/imprint', '/settings'].includes(current)) {
      window.history.pushState(null, '', '/')
    }
  }, [stage])

  const facts = useMemo(() => {
    if (!chat || chat.messages.length === 0) return null
    try {
      return analyzeHardFacts(chat)
    } catch (e) {
      console.error('[analyzeHardFacts]', e)
      return null
    }
  }, [chat])

  const canAnalyzeRelationship = (chat?.participants.length ?? 0) === 2

  const networkMode: NetworkMode =
    stage === 'ai' || stage === 'relationship_loading'
      ? 'ai'
      : stage === 'profiles' || stage === 'relationship'
        ? 'done'
        : 'local'

  const handleFile = async (text: string, name: string) => {
    setParseError(null)
    track('upload_started')
    const parsed = parseWhatsApp(text)
    if (parsed.messages.length === 0) {
      setParseError(
        parsed.warnings[0] ??
          (locale === 'de' ? 'keine nachrichten gefunden — hmm.' : 'no messages found — hmm.'),
      )
      track('upload_failed', { reason: 'no_messages' })
      return
    }
    const meta = chatLibrary.create(parsed, name)
    // Self detection — try Google profile name first (highest confidence when
    // signed in), then filename heuristic, then email. Final fallback is
    // participants[0]: imperfect but matches the user expectation that the
    // app "just picks" without showing a chooser screen.
    const fullName = (session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? null) as string | null
    const inferred = inferSelfPerson(
      { fileName: name, fullName, email: session?.user?.email ?? null },
      parsed,
    )
    const self = inferred ?? parsed.participants[0] ?? null
    if (self) chatLibrary.setSelf(meta.id, self)
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
        locale === 'de'
          ? `dein chat ist ~${sizeMb} MB — das ist zu groß für dieses gerät. exportier einen kürzeren ausschnitt — z.B. nur die letzten paar monate.`
          : `your chat is ~${sizeMb} MB — that's too big to stash on this device. export a shorter slice — like just the last few months.`,
      )
      track('upload_failed', { reason: 'too_big' })
      return
    }
    clearLocalState()
    setCurrentChatId(meta.id)
    setFileName(name)
    setChat(parsed)
    setStage('parsing')
    track('upload_parsed', { messages: parsed.messages.length, participants: parsed.participants.length })
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
        locale === 'de'
          ? 'dieser chat ist nicht mehr auf deinem gerät — wahrscheinlich gelöscht oder zu groß. karte fliegt.'
          : "this chat isn't on your device anymore — probably deleted or too big. kicking the card.",
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
    // Library re-opens always go to the scroll layout. The exhibit (slide-by-
    // slide) is for the first-time post-upload reveal; if the user is back
    // here via the library, they've already met the chat once.
    chatLibrary.markExhibitSeen(id)
    setStage('analysis')
    track('library_chat_opened')
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
    // Don't pre-pick self here — the consent screen has a picker and gates
    // the Accept button until one is selected. Guessing silently is what
    // caused wrong analyses in the first place.
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  const rerunModule = (moduleId: ModuleId) => {
    if (!chat) return
    if (moduleId === 'profiles') setProfiles(null)
    if (moduleId === 'relationship') setRelationship(null)
    setPendingModule(moduleId)
    if (!prepared) {
      const p = prepareAnalysis(chat)
      setPrepared(p)
      setStage('consent')
      return
    }
    dispatchModule(moduleId)
  }

  // Direct module click from HardFactsView. Gates: sign in → credits → consent.
  const startModule = (moduleId: ModuleId) => {
    if (!chat) return
    if (moduleId === 'relationship' && !canAnalyzeRelationship) return
    // Already have a result → just navigate there, no credit spent.
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

    // Paywall gate. Every visitor has an anonymous session by now, so the
    // only check that actually gates the flow is "has credits" — users can
    // transact before they've signed up, we nudge them to Google after.
    const disabled = import.meta.env.VITE_PAYWALL_DISABLED === 'true'
    if (!disabled) {
      if ((balance ?? 0) <= 0) {
        setPendingModule(moduleId)
        setStage('credits')
        return
      }
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

  const dispatchModule = (moduleId: ModuleId) => {
    switch (moduleId) {
      case 'profiles':
        return runAi()
      case 'relationship':
        return goToRelationship()
    }
  }

  const onConsentAccept = () => dispatchModule(pendingModule)

  const runAi = async () => {
    if (!chat || !prepared) return
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    // Self is set at upload via inferSelfPerson, but fall back to first
    // participant if somehow missing — we never want to hang silently here.
    const selfPerson = meta?.selfPerson ?? chat.participants[0]
    if (!selfPerson) return
    setAiError(null)
    setAiProgress({ done: 0, total: 1, current: selfPerson })
    setStage('ai')
    track('analysis_started', { module: 'profiles' })
    try {
      const results = await runProfileAnalyses({
        chat,
        prepared,
        targetPersons: [selfPerson],
        onProgress: (done, total, current) => setAiProgress({ done, total, current }),
      })
      setProfiles(results)
      setStage('profiles')
      track('analysis_completed', { module: 'profiles' })
    } catch (e) {
      const err = e as Error
      setAiError(err.message ?? t('app.analysis.failed', locale))
      track('analysis_failed', { module: 'profiles' })
    } finally {
      // Always refresh — on failure the server has refunded the credit, we
      // need to pull the refunded balance so the UI doesn't display the
      // transient "minus 1" state.
      void refreshCredits()
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
    track('analysis_started', { module: 'relationship' })
    try {
      const result = await runRelationshipAnalysis({ chat, prepared })
      setRelationship(result)
      setStage('relationship')
      track('analysis_completed', { module: 'relationship' })
    } catch (e) {
      const err = e as Error
      setRelationshipError(err.message ?? t('app.relationship.failed', locale))
      track('analysis_failed', { module: 'relationship' })
    } finally {
      void refreshCredits()
    }
  }

  // Buy a credit pack — opens Stripe's embedded checkout. On completion, the
  // webhook credits the account server-side and the realtime subscription in
  // useCredits refreshes the badge + balance automatically.
  const handleBuyPack = async (pack: Pack) => {
    setPayError(null)
    setCheckoutLoading(true)
    try {
      const { clientSecret } = await startPackCheckout(pack)
      setCheckout({ clientSecret })
      track('checkout_opened', { pack: pack.id })
    } catch (e) {
      setPayError((e as Error).message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleCheckoutComplete = () => {
    setCheckout(null)
    void refreshCredits()
    track('checkout_completed')
    // After a successful purchase, kick the user back to where they came
    // from. If a chat is loaded, that's the analysis screen — they almost
    // always bought credits to unlock a module on it. If there's no chat,
    // fall back to the library or the upload landing.
    if (chat) {
      setStage('analysis')
    } else {
      setStage(chatLibrary.get().length > 0 ? 'library' : 'upload')
    }
    // First-time buyers are on anonymous sessions — nudge them to link
    // Google so the credits survive a cleared browser.
    if (session?.user?.is_anonymous) {
      setShowKeepPrompt(true)
    }
  }

  // Tab mapping for the bottom-nav
  const currentTab: 'leaks' | 'intel' | 'files' =
    stage === 'library' || stage === 'upload' || stage === 'parsing'
      ? 'leaks'
      : stage === 'analysis' ||
          stage === 'consent' ||
          stage === 'ai' ||
          stage === 'relationship_loading'
        ? 'intel'
        : 'files'

  return (
    <div className="min-h-screen bg-bg text-ink pb-20">
      {checkout && (
        <CheckoutModal
          clientSecret={checkout.clientSecret}
          onComplete={handleCheckoutComplete}
          onClose={() => {
            track('checkout_dismissed')
            setCheckout(null)
          }}
        />
      )}
      {showKeepPrompt && (
        <KeepCreditsModal
          onSignIn={async () => {
            setShowKeepPrompt(false)
            try {
              await signInWithGoogle()
            } catch (e) {
              setPayError((e as Error).message)
            }
          }}
          onDismiss={() => setShowKeepPrompt(false)}
        />
      )}
      {checkoutLoading && !checkout && (
        <div className="fixed inset-0 z-[75] bg-ink/80 backdrop-blur-sm flex items-center justify-center">
          <div
            className="bg-pop-yellow border-2 border-ink px-6 py-4 font-mono text-xs uppercase tracking-[0.18em]"
            style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
          >
            {t('app.pay.opening', locale)}
          </div>
        </div>
      )}
      {payError && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] max-w-md bg-pop-yellow border-2 border-ink px-4 py-3 flex items-start gap-3"
          style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 mt-0.5">
            {t('app.pay.errorLabel', locale)}
          </span>
          <p className="font-serif text-sm text-ink flex-1 leading-snug">{payError}</p>
          <button
            onClick={() => setPayError(null)}
            aria-label="Dismiss"
            className="text-ink hover:bg-ink hover:text-pop-yellow w-6 h-6 flex items-center justify-center leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-black text-white border-b-2 border-ink">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-4">
          <button onClick={goToLibrary} className="flex items-baseline gap-2 group">
            <span className="font-serif italic text-2xl tracking-tight text-white group-hover:text-yellow-300 transition-colors">tea</span>
            <span className="bg-pop-yellow text-ink px-1.5 leading-none text-2xl font-serif">.</span>
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 ml-3">{t('nav.localOnly', locale)}</span>
          </button>
          <div className="flex items-center gap-3 text-white">
            {currentChatId && stage !== 'library' && (
              <button
                onClick={goToLibrary}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
              >
                {t('nav.backToLeaks', locale)}
              </button>
            )}
            {stage === 'profiles' && (
              <>
                <button
                  onClick={() => setStage('analysis')}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
                >
                  {t('app.nav.hardFacts', locale)}
                </button>
                {canAnalyzeRelationship && (
                  <button
                    onClick={goToRelationship}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-pop-yellow hover:text-white transition-colors hidden md:inline"
                  >
                    {t('app.nav.relationship', locale)}
                  </button>
                )}
              </>
            )}
            {stage === 'relationship' && (
              <button
                onClick={() => setStage('profiles')}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-pop-yellow transition-colors hidden md:inline"
              >
                {t('app.nav.personal', locale)}
              </button>
            )}
            <NetworkIndicator
              mode={networkMode}
              detail={
                (stage === 'ai' || stage === 'relationship_loading') &&
                prepared
                  ? prepared.analyzerKind === 'fixture'
                    ? t('app.net.testDetail', locale)
                    : t('app.net.liveDetail', locale, { n: prepared.messagesSent })
                  : undefined
              }
            />
            <CreditsBadge
              onOpen={() => setStage('credits')}
              onSignIn={async () => {
              try { await signInWithGoogle() }
              catch (e) { setPayError((e as Error).message) }
            }}
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
                    {t('app.nav.backToLibrary', locale)}
                  </button>
                </div>
              )}
              <Upload onFile={handleFile} />
              {parseError && (
                <div className="mt-8 max-w-2xl mx-auto card border-b/50">
                  <div className="label-mono text-b mb-2">{t('app.error.parse', locale)}</div>
                  <p className="serif-body text-lg">{parseError}</p>
                  {fileName && <div className="label-mono mt-3">{t('app.fileLabel', locale, { name: fileName })}</div>}
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
              creditsBalance={balance ?? 0}
              onBuyCredits={() => setStage('credits')}
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
            onRerun={() => rerunModule('profiles')}
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
            onRerun={() => rerunModule('relationship')}
          />
        )}

        {stage === 'credits' && (
          <CreditsPage
            onBuy={handleBuyPack}
            onBack={() => setStage(chat ? 'analysis' : library.length > 0 ? 'library' : 'upload')}
            onSignIn={async () => {
              try { await signInWithGoogle() }
              catch (e) { setPayError((e as Error).message) }
            }}
          />
        )}

        {stage === 'analysis' && !facts && (
          <div className="max-w-2xl mx-auto p-12 text-center">
            <p className="serif-body text-xl">{t('app.error.noFacts', locale)}</p>
            <button onClick={reset} className="mt-6 px-5 py-3 bg-ink text-bg rounded-full font-sans text-sm">
              {t('app.error.tryAgain', locale)}
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
              {t('nav.leaks', locale)}
            </button>
            <button
              onClick={() => chat && setStage('analysis')}
              disabled={!chat}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${currentTab === 'intel' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/></svg>
              {t('nav.intel', locale)}
            </button>
            <button
              onClick={() => profiles && setStage('profiles')}
              disabled={!profiles && !relationship}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${currentTab === 'files' ? 'text-pop-yellow' : 'text-white/50 hover:text-white'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3 L7 3 L8 5 L14 5 L14 13 L2 13 Z"/></svg>
              {t('nav.files', locale)}
            </button>
          </div>
          <div className="flex items-center gap-3 md:gap-5 font-mono text-[10px] tracking-[0.14em] uppercase">
            <button
              onClick={() => setStage('credits')}
              className="text-white/50 hover:text-pop-yellow transition-colors"
            >
              {locale === 'de' ? 'credits' : 'credits'}
            </button>
            <button
              onClick={() => setStage('settings')}
              className="text-white/50 hover:text-pop-yellow transition-colors"
            >
              {t('nav.settings', locale)}
            </button>
            <button
              onClick={() => setStage('privacy')}
              className="text-white/50 hover:text-pop-yellow transition-colors"
            >
              {t('nav.privacy', locale)}
            </button>
            <button
              onClick={() => setStage('imprint')}
              className="text-white/50 hover:text-pop-yellow transition-colors hidden md:inline"
            >
              {t('nav.imprint', locale)}
            </button>
          </div>
        </div>
      </nav>
    </div>
  )
}

function PrivacyStripe() {
  const locale = useLocale()
  const items = [
    { title: t('app.privacyStripe.01.title', locale), body: t('app.privacyStripe.01.body', locale) },
    { title: t('app.privacyStripe.02.title', locale), body: t('app.privacyStripe.02.body', locale) },
    { title: t('app.privacyStripe.03.title', locale), body: t('app.privacyStripe.03.body', locale) },
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

export default App
