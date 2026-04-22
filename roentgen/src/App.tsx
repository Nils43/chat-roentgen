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
import {
  findUsableReceipt,
  getReceipt,
  markLocalSpent,
  pollUnlock,
  saveReceipt,
  startCheckout,
  type UnlockModule,
} from './payments/client'
import { CheckoutModal, getStripe } from './components/CheckoutModal'
import { AiBundleProgress, type BundleStepState } from './components/AiBundleProgress'

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
  | 'ai_bundle'
  | 'privacy'
  | 'imprint'
  | 'settings'

function App() {
  const library = useChatLibrary()
  const locale = useLocale()
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

  // Active Stripe checkout session — when non-null, the CheckoutModal is open.
  // clientSecret comes from /api/checkout; Stripe mounts its embedded form with
  // it and fires onComplete when payment is done.
  const [checkout, setCheckout] = useState<null | { clientSecret: string; token: string; module: UnlockModule }>(null)
  // Which button is currently fetching a checkout session. Prevents double
  // clicks and gives the paywall a loading state while we wait on the server.
  const [pendingBuy, setPendingBuy] = useState<UnlockModule | null>(null)
  const [unlockInFlight, setUnlockInFlight] = useState(false)
  const [pendingModule, setPendingModule] = useState<ModuleId>('profiles')

  // Bundle flow: when user paid for both, we run Personal + Relationship in
  // parallel. The `pendingBundle` flag routes the consent-accept to runBundle
  // instead of a single-module dispatch. `bundleProgress` drives the loader.
  const [pendingBundle, setPendingBundle] = useState(false)
  const [bundleProgress, setBundleProgress] = useState<{
    profile: BundleStepState
    relationship: BundleStepState
  }>({ profile: 'pending', relationship: 'pending' })

  // Pre-warm Stripe.js at app start so the modal opens instantly on first click
  // instead of flashing empty while Stripe's script downloads.
  useEffect(() => {
    void getStripe()
  }, [])

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
      setParseError(
        parsed.warnings[0] ??
          (locale === 'de' ? 'keine nachrichten gefunden — hmm.' : 'no messages found — hmm.'),
      )
      return
    }
    const meta = chatLibrary.create(parsed, name)
    // Filename-based self-detection: `WhatsApp Chat mit Lena.txt` means the
    // user is the *other* participant. If that can't be inferred we default to
    // the first participant — it skips the self-pick step entirely. The user
    // never sees a "which one is you?" screen.
    const self = inferSelfPerson(name, parsed) ?? parsed.participants[0] ?? null
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
    // `selfPerson` is set during upload (filename inference, or first
    // participant as default). It's always truthy by the time we reach here —
    // no prompt-for-self step.
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    if (!meta?.selfPerson && currentChatId) {
      chatLibrary.setSelf(currentChatId, chat.participants[0] ?? '')
    }
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  // Re-run a module even when we already have a result (e.g. user switched
  // language and wants the analysis regenerated in the new language).
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

  // Consent screen's accept handler. If the user paid for the bundle, run both
  // modules in parallel; otherwise dispatch the single pending one.
  const onConsentAccept = () => {
    if (pendingBundle) return runBundle()
    return dispatchModule(pendingModule)
  }

  // Bundle entry point — same gates as startAiAnalysis (selfPerson picked →
  // consent) but sets `pendingBundle` so the consent accept fires runBundle.
  const startBundle = () => {
    if (!chat) return
    setPendingBundle(true)
    setPendingModule('profiles')
    // Self-person is set at upload time — no picker step.
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    if (!meta?.selfPerson && currentChatId) {
      chatLibrary.setSelf(currentChatId, chat.participants[0] ?? '')
    }
    const p = prepareAnalysis(chat)
    setPrepared(p)
    setStage('consent')
  }

  const runBundle = async () => {
    if (!chat) return
    const p = prepared ?? prepareAnalysis(chat)
    if (!prepared) setPrepared(p)
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    const selfPerson = meta?.selfPerson ?? chat.participants[0]
    if (!selfPerson) return
    // The bundle token covers both halves; pull the shared receipt once.
    const receipt = findUsableReceipt('profiles') ?? findUsableReceipt('relationship')
    setAiError(null)
    setRelationshipError(null)
    setBundleProgress({ profile: 'running', relationship: 'running' })
    setStage('ai_bundle')

    const profilePromise = runProfileAnalyses({
      chat,
      prepared: p,
      targetPersons: [selfPerson],
      unlockToken: receipt?.token,
      onProgress: () => {},
    })
      .then((results) => {
        if (receipt) markLocalSpent(receipt.token, 'profiles')
        setProfiles(results)
        setBundleProgress((s) => ({ ...s, profile: 'done' }))
        return true
      })
      .catch((e: Error) => {
        setAiError(e.message ?? t('app.analysis.failed', locale))
        setBundleProgress((s) => ({ ...s, profile: 'error' }))
        return false
      })

    const relPromise = runRelationshipAnalysis({
      chat,
      prepared: p,
      unlockToken: receipt?.token,
    })
      .then((result) => {
        if (receipt) markLocalSpent(receipt.token, 'relationship')
        setRelationship(result)
        setBundleProgress((s) => ({ ...s, relationship: 'done' }))
        return true
      })
      .catch((e: Error) => {
        setRelationshipError(e.message ?? 'vibe read failed.')
        setBundleProgress((s) => ({ ...s, relationship: 'error' }))
        return false
      })

    const [profileOk, relOk] = await Promise.all([profilePromise, relPromise])
    // Land on whichever succeeded. Prefer profile if both are ready — user
    // picked the bundle, we start them in the personal file.
    setPendingBundle(false)
    if (profileOk) setStage('profiles')
    else if (relOk) setStage('relationship')
    // If neither succeeded, stay on ai_bundle so the user sees both errors +
    // retry buttons.
  }

  const runAi = async () => {
    if (!chat || !prepared) return
    // Only the user themselves is profiled — the other person has not
    // consented to be psychologically analyzed.
    const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
    const selfPerson = meta?.selfPerson ?? chat.participants[0]
    if (!selfPerson) return
    const receipt = findUsableReceipt('profiles')
    setAiError(null)
    setAiProgress({ done: 0, total: 1, current: selfPerson })
    setStage('ai')
    try {
      const results = await runProfileAnalyses({
        chat,
        prepared,
        targetPersons: [selfPerson],
        unlockToken: receipt?.token,
        onProgress: (done, total, current) => setAiProgress({ done, total, current }),
      })
      if (receipt) markLocalSpent(receipt.token, 'profiles')
      setProfiles(results)
      setStage('profiles')
    } catch (e) {
      const err = e as Error
      setAiError(err.message ?? t('app.analysis.failed', locale))
    }
  }

  const goToRelationship = async () => {
    if (!chat || !prepared) return
    if (!canAnalyzeRelationship) return
    if (relationship) {
      setStage('relationship')
      return
    }
    const receipt = findUsableReceipt('relationship')
    setRelationshipError(null)
    setStage('relationship_loading')
    try {
      const result = await runRelationshipAnalysis({
        chat,
        prepared,
        unlockToken: receipt?.token,
      })
      if (receipt) markLocalSpent(receipt.token, 'relationship')
      setRelationship(result)
      setStage('relationship')
    } catch (e) {
      const err = e as Error
      setRelationshipError(err.message ?? t('app.relationship.failed', locale))
    }
  }

  // Entry point from the paywall. If the user already has a paid receipt for
  // this module we skip Stripe and dispatch straight to the module. Otherwise
  // we open the embedded-checkout modal with a fresh session client_secret.
  const handleUnlock = async (requested: UnlockModule) => {
    if (!chat) return
    if (pendingBuy) return // guard against double-clicks while /api/checkout flies
    const first: 'profiles' | 'relationship' = requested === 'relationship' ? 'relationship' : 'profiles'
    // Dev/preview toggle: skip the paywall entirely so the team can click
    // through the product without charging themselves.
    if (import.meta.env.VITE_PAYWALL_DISABLED === 'true') {
      if (requested === 'bundle') return startBundle()
      startModule(first)
      return
    }
    const existing = findUsableReceipt(first)
    if (existing) {
      // Fresh bundle (nothing spent yet) → run both halves in parallel.
      // Bundle with one half already spent, or a single-module receipt →
      // dispatch that one module only.
      if (existing.module === 'bundle' && (existing.spent ?? []).length === 0) {
        return startBundle()
      }
      startModule(first)
      return
    }
    setPendingBuy(requested)
    try {
      const session = await startCheckout({ module: requested })
      setCheckout(session)
    } catch (e) {
      const err = e as Error
      setPayError(err.message)
    } finally {
      setPendingBuy(null)
    }
  }
  const [payError, setPayError] = useState<string | null>(null)

  // Stripe's embedded checkout fires onComplete right after the customer
  // finishes payment. The webhook may race us, so we poll KV briefly until we
  // see `paid`, then stash the receipt locally and dispatch the analysis.
  const handleCheckoutComplete = async () => {
    const session = checkout
    if (!session) return
    setCheckout(null)
    setUnlockInFlight(true)
    try {
      const pending = getReceipt(session.token)
      const remote = await pollUnlock(session.token, { timeoutMs: 30_000 })
      if (remote.paid && remote.module) {
        saveReceipt({
          token: session.token,
          module: remote.module,
          paid: true,
          createdAt: pending?.createdAt ?? new Date().toISOString(),
          spent: remote.spent,
        })
        if (remote.module === 'bundle') {
          startBundle()
        } else {
          const first: 'profiles' | 'relationship' =
            remote.module === 'relationship' ? 'relationship' : 'profiles'
          startModule(first)
        }
      } else {
        setPayError(t('app.pay.unconfirmed', locale))
      }
    } finally {
      setUnlockInFlight(false)
    }
  }

  // Tab mapping for the bottom-nav (LEAKS / INTEL / FILES)
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
          onClose={() => setCheckout(null)}
        />
      )}
      {(pendingBuy && !checkout) && (
        <div className="fixed inset-0 z-[75] bg-ink/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-pop-yellow border-2 border-ink px-6 py-4 font-mono text-xs uppercase tracking-[0.18em]" style={{ boxShadow: '4px 4px 0 #0A0A0A' }}>
            {t('app.pay.opening', locale)}
          </div>
        </div>
      )}
      {unlockInFlight && (
        <div className="fixed inset-0 z-[75] bg-ink/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-pop-yellow border-2 border-ink px-6 py-4 font-mono text-xs uppercase tracking-[0.18em]" style={{ boxShadow: '4px 4px 0 #0A0A0A' }}>
            {t('app.pay.confirming', locale)}
          </div>
        </div>
      )}
      {payError && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] max-w-md bg-pop-yellow border-2 border-ink px-4 py-3 flex items-start gap-3"
          style={{ boxShadow: '4px 4px 0 #0A0A0A' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60 mt-0.5">{t('app.pay.errorLabel', locale)}</span>
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
              onBuy={handleUnlock}
              pendingBuy={pendingBuy}
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

        {stage === 'ai_bundle' && (
          <AiBundleProgress
            personal={bundleProgress.profile}
            relationship={bundleProgress.relationship}
            personalError={aiError}
            relationshipError={relationshipError}
            onBack={() => setStage('analysis')}
            onRetry={(which) => {
              // Kick the failed half alone. Bundle token is still half-unspent
              // server-side, so a retry hits the same token and goes through.
              if (which === 'personal') {
                setBundleProgress((s) => ({ ...s, profile: 'running' }))
                setAiError(null)
                void (async () => {
                  if (!chat || !prepared) return
                  const meta = currentChatId ? chatLibrary.getMeta(currentChatId) : undefined
                  const selfPerson = meta?.selfPerson ?? chat.participants[0]
                  const receipt = findUsableReceipt('profiles')
                  try {
                    const results = await runProfileAnalyses({
                      chat,
                      prepared,
                      targetPersons: [selfPerson],
                      unlockToken: receipt?.token,
                      onProgress: () => {},
                    })
                    if (receipt) markLocalSpent(receipt.token, 'profiles')
                    setProfiles(results)
                    setBundleProgress((s) => ({ ...s, profile: 'done' }))
                    if (bundleProgress.relationship === 'done') setStage('profiles')
                  } catch (e) {
                    setAiError((e as Error).message)
                    setBundleProgress((s) => ({ ...s, profile: 'error' }))
                  }
                })()
              } else {
                setBundleProgress((s) => ({ ...s, relationship: 'running' }))
                setRelationshipError(null)
                void (async () => {
                  if (!chat || !prepared) return
                  const receipt = findUsableReceipt('relationship')
                  try {
                    const result = await runRelationshipAnalysis({
                      chat,
                      prepared,
                      unlockToken: receipt?.token,
                    })
                    if (receipt) markLocalSpent(receipt.token, 'relationship')
                    setRelationship(result)
                    setBundleProgress((s) => ({ ...s, relationship: 'done' }))
                    if (bundleProgress.profile === 'done') setStage('profiles')
                  } catch (e) {
                    setRelationshipError((e as Error).message)
                    setBundleProgress((s) => ({ ...s, relationship: 'error' }))
                  }
                })()
              }
            }}
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
