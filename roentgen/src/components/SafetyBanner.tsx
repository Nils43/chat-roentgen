import { useLocale } from '../i18n'

interface Props {
  pattern: string
  context?: string
}

// Red-flag banner — surfaces concerning patterns and routes to real help.
// Used by RelationshipView when the AI flags concerning dynamics (control,
// gaslighting, threats, abuse signals).
export function SafetyBanner({ pattern, context }: Props) {
  const locale = useLocale()
  const de = locale === 'de'
  return (
    <aside
      className="card my-6"
      style={{
        background: '#0A0A0A',
        color: '#FFFFFF',
        borderColor: '#FFE234',
        borderWidth: '3px',
        boxShadow: '6px 6px 0 #FFE234',
        transform: 'rotate(-0.4deg)',
      }}
    >
      <span
        className="exhibit-label"
        style={{
          background: '#FFE234',
          color: '#0A0A0A',
          transform: 'rotate(-3deg)',
          left: '20px',
          top: '-12px',
        }}
      >
        {de ? '⚠ SICHERHEIT · BITTE ERNST NEHMEN' : '⚠ SAFETY · TAKE SERIOUSLY'}
      </span>

      <div className="mt-3">
        <div className="font-serif text-2xl md:text-3xl tracking-tight mb-3 leading-tight">
          {de
            ? 'Der Chat zeigt Muster, die ernst zu nehmen sind.'
            : 'The chat is showing patterns worth taking seriously.'}
        </div>
        <p className="font-mono italic text-base leading-relaxed mb-4 text-white/85">
          {pattern}
        </p>
        {context && (
          <p className="font-mono italic text-sm leading-relaxed mb-4 text-white/65">
            {context}
          </p>
        )}

        <div className="border-t border-white/20 pt-4 mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-pop-yellow mb-3">
            {de ? '→ Anonyme Hilfe, jederzeit' : '→ Anonymous help, anytime'}
          </div>
          <ul className="space-y-1.5 font-mono text-sm">
            <li className="flex gap-3 items-baseline">
              <span className="text-pop-yellow font-bold tabular-nums shrink-0">116 016</span>
              <span className="text-white/85">
                {de
                  ? 'Hilfetelefon Gewalt gegen Frauen · DE · 24/7, kostenlos, mehrsprachig'
                  : 'Violence against women helpline · DE · 24/7, free, multilingual'}
              </span>
            </li>
            <li className="flex gap-3 items-baseline">
              <span className="text-pop-yellow font-bold tabular-nums shrink-0">0800 111 0 111</span>
              <span className="text-white/85">
                {de
                  ? 'Telefonseelsorge · DE · 24/7, kostenlos, anonym'
                  : 'Telefonseelsorge (crisis line) · DE · 24/7, free, anonymous'}
              </span>
            </li>
            <li className="flex gap-3 items-baseline">
              <span className="text-pop-yellow font-bold tabular-nums shrink-0">1-800-799-7233</span>
              <span className="text-white/85">
                {de
                  ? 'National Domestic Violence Hotline · US · 24/7, kostenlos, mehrsprachig'
                  : 'National Domestic Violence Hotline · US · 24/7, free, multilingual'}
              </span>
            </li>
            <li className="flex gap-3 items-baseline">
              <span className="text-pop-yellow font-bold tabular-nums shrink-0">988</span>
              <span className="text-white/85">
                {de
                  ? 'Suicide & Crisis Lifeline · US · Anruf oder SMS, 24/7'
                  : 'Suicide & Crisis Lifeline · US · call or text, 24/7'}
              </span>
            </li>
          </ul>
          <p className="font-mono text-[11px] text-white/50 mt-4 leading-snug">
            {de
              ? 'Diese Analyse ist keine Diagnose. Wenn du dich nicht sicher fühlst — vertrau dem Gefühl, nicht der App.'
              : "This analysis is not a diagnosis. If you don't feel safe — trust the feeling, not the app."}
          </p>
        </div>
      </div>
    </aside>
  )
}
