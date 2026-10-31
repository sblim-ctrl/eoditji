import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

// 메일에는 코드와 링크가 함께 가지만 화면은 코드 입력이 기본 (휴대폰 메일 앱의 링크는 다른 브라우저로 열릴 수 있음)
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setIsBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setIsBusy(false)
    if (error) {
      setError(error.status === 429
        ? '메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.'
        : '메일을 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요.')
      return
    }
    setIsCodeSent(true)
  }

  // 구글로 갔다가 돌아오면 supabase-js가 주소의 토큰을 읽어 세션을 만듦. "내 집"은 DB 트리거가 만듦
  async function signInWithGoogle() {
    setIsBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setIsBusy(false)
      setError('구글 로그인을 시작하지 못했어요. 다시 시도해 주세요.')
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setIsBusy(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setIsBusy(false)
    // 성공하면 App의 onAuthStateChange가 화면을 바꿈
    if (error) setError('코드가 맞지 않거나 만료됐어요. 다시 확인해 주세요.')
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">어디있지</h1>
      {isCodeSent ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <label htmlFor="code" className="text-sm">
            {email}로 보낸 메일의 코드를 입력하세요.
          </label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={isBusy}>로그인</Button>
          <Button type="button" variant="ghost" onClick={() => { setIsCodeSent(false); setCode(''); setError('') }}>
            이메일 다시 입력
          </Button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm">이메일로 로그인 코드를 보내 드려요.</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={isBusy}>코드 받기</Button>
          <Button type="button" variant="outline" disabled={isBusy} onClick={signInWithGoogle}>
            구글로 계속하기
          </Button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </main>
  )
}
