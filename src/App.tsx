import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { LoginPage } from '@/features/auth/LoginPage'
import { supabase } from '@/lib/supabase'

function App() {
  // undefined: 세션 확인 중, null: 로그아웃 상태
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <LoginPage />
  return <Home />
}

// D1 최소 화면: 내 그룹 이름과 로그아웃
function Home() {
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('groups').select('name').limit(1).single().then(({ data, error }) => {
      if (error) setError('그룹을 불러오지 못했어요.')
      else setGroupName(data.name)
    })
  }, [])

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">{groupName}</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button variant="outline" onClick={() => supabase.auth.signOut()}>로그아웃</Button>
    </main>
  )
}

export default App
