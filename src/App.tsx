import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoginPage } from '@/features/auth/LoginPage'
import { ChatPage } from '@/features/chat/ChatPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { supabase } from '@/lib/supabase'

function App() {
  // undefined: 세션 확인 중, null: 로그아웃 상태
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return isLoginOpen ? <LoginPage /> : <LandingPage onStart={() => setIsLoginOpen(true)} />
  return <ChatPage userId={session.user.id} />
}

export default App
