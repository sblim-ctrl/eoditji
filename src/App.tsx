import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoginPage } from '@/features/auth/LoginPage'
import { ChatPage } from '@/features/chat/ChatPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { supabase } from '@/lib/supabase'

const LOGIN_HASH = '#login'

function App() {
  // undefined: 세션 확인 중, null: 로그아웃 상태
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // 로그인 화면은 주소 #login으로 열어서 브라우저 뒤로가기로 랜딩에 돌아옴
  const [isLoginOpen, setIsLoginOpen] = useState(() => window.location.hash === LOGIN_HASH)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const syncLogin = () => setIsLoginOpen(window.location.hash === LOGIN_HASH)
    window.addEventListener('hashchange', syncLogin)
    return () => window.removeEventListener('hashchange', syncLogin)
  }, [])

  if (session === undefined) return null
  if (!session) return isLoginOpen ? <LoginPage /> : <LandingPage onStart={() => { window.location.hash = LOGIN_HASH }} />
  return <ChatPage userId={session.user.id} />
}

export default App
