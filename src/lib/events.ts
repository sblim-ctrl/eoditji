// 화면 이벤트 (PRD 05 데이터 로깅). AI 호출 결과(receive_draft, LLM 단계 view_search_result)는 함수가 남긴다.
import { supabase } from '@/lib/supabase'

export type EventName =
  | 'start_capture' | 'select_item' | 'label_item' | 'answer_question' | 'skip_question' | 'save_place'
  | 'click_try_question' | 'submit_search' | 'view_search_result' | 'learn_alias' | 'click_search_feedback' | 'receive_failure'
  | 'create_group' | 'create_invite' | 'join_group' | 'toggle_place_share'

// 지표용이라 실패해도 화면 흐름은 막지 않는다. supabase 쿼리는 then을 불러야 실행된다
export function track(name: EventName, props: Record<string, unknown> = {}): void {
  supabase.from('events').insert({ name, props }).then(() => {}, () => {})
}
