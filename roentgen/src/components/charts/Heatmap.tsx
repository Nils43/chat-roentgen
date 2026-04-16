interface Props {
  matrix: number[][] // [dow 0=Mo..6=So][hour 0..23]
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function Heatmap({ matrix }: Props) {
  const max = Math.max(1, ...matrix.flat())

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="inline-flex flex-col gap-1 min-w-full">
        {/* Hour axis */}
        <div className="flex gap-[3px] pl-8 text-[9px] text-ink-faint font-mono">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="w-4 text-center">
              {h % 6 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {matrix.map((row, dowIdx) => (
          <div key={dowIdx} className="flex items-center gap-[3px]">
            <span className="label-mono w-6 text-right">{DAYS[dowIdx]}</span>
            {row.map((v, hour) => {
              const intensity = v / max
              const alpha = intensity === 0 ? 0.04 : 0.15 + intensity * 0.85
              return (
                <div
                  key={hour}
                  title={`${DAYS[dowIdx]} ${hour}:00 · ${v} Nachrichten`}
                  className="w-4 h-4 rounded-sm transition-all hover:scale-125"
                  style={{
                    backgroundColor: `rgba(127, 224, 196, ${alpha})`,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
