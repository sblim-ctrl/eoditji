import type { Quick } from './useChatFlow'

type QuickRepliesProps = { options: Quick[]; onPick: (q: Quick) => void }

export function QuickReplies({ options, onPick }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((q) => (
        <button
          key={q.label}
          type="button"
          onClick={() => onPick(q)}
          className="persona-round min-h-11 rounded-full border border-primary bg-card px-4 text-sm font-medium text-primary hover:bg-accent"
        >
          {q.label}
        </button>
      ))}
    </div>
  )
}
