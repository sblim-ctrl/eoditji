import type { Persona } from '@/lib/personas'
import { Avatar } from './Avatar'
import { PlaceCard } from './PlaceCard'
import { QuickReplies } from './QuickReplies'
import type { Msg, Quick } from './useChatFlow'

type MessageListProps = {
  messages: Msg[]
  persona: Persona
  onPick: (q: Quick) => void
  onRemove: (index: number) => void
}

export function MessageList({ messages, persona, onPick, onRemove }: MessageListProps) {
  return (
    <ol aria-live="polite" className="flex flex-col gap-3.5 pt-2 pb-6">
      {messages.map((m) =>
        m.from === 'me' ? (
          <li key={m.id} className="flex justify-end">
            <div className="flex max-w-[min(560px,85%)] min-w-0 flex-col items-end gap-2">
              {m.photoUrl && <img src={m.photoUrl} alt="보낸 사진" className="block w-[200px] max-w-full rounded-[14px]" />}
              {m.text && <div className="bubble-me rounded-[18px] rounded-tr-md bg-me px-3.5 py-2.5 whitespace-pre-wrap text-me-foreground [overflow-wrap:anywhere]">{m.text}</div>}
            </div>
          </li>
        ) : (
          <li key={m.id} className="flex items-start gap-2.5">
            <Avatar persona={persona} size={32} />
            <div className="flex max-w-[min(560px,85%)] min-w-0 flex-col items-start gap-2">
              <div className={`bubble-bot rounded-[18px] rounded-tl-md bg-bot px-3.5 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere] ${m.typing ? 'flex items-center gap-2.5 text-muted-foreground' : ''}`}>
                {m.typing && <span className="dots" aria-hidden="true"><i /><i /><i /></span>}
                {m.text}
              </div>
              {m.place && <PlaceCard place={m.place} hitId={m.hitId} onRemove={m.editable ? onRemove : undefined} />}
              {m.quick && <QuickReplies options={m.quick} onPick={onPick} />}
            </div>
          </li>
        ),
      )}
    </ol>
  )
}
