import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

// 로그인 화면은 다크 모드·대화 상대 테마 토큰과 상관없이 밝은 중립색으로 고정
const FIELD = 'h-12 rounded-xl border-gray-300 bg-white px-4 text-gray-900 placeholder:text-gray-400 focus-visible:border-gray-900 focus-visible:ring-gray-900/15'
const BUTTON = 'h-12 w-full rounded-xl'
const SUBMIT = `${BUTTON} bg-gray-900 text-white hover:bg-gray-800`

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

  // 구글로 갔다가 돌아오면 supabase-js가 주소의 토큰을 읽어 세션을 만듦. "우리 집"은 DB 트리거가 만듦
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
    <div className="flex min-h-svh">
      {/* 왼쪽 브랜드 패널: 폰 화면에서는 폼만 보이도록 숨김. 대화 상대 테마와 무관한 중립 색 */}
      <aside className="hidden flex-1 flex-col items-center justify-center bg-stone-100 p-12 text-center md:flex">
        <DrawerArt />
        <p className="mt-10 text-4xl font-bold text-stone-800">어디있지?</p>
        <p className="mt-3 text-lg text-stone-500">넣어 둔 곳, 사진 한 장으로 기억해요</p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-4">
        <div className="w-full max-w-md py-8">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">어디있지?</h1>
            <p className="text-gray-600">
              {isCodeSent ? `${email}로 보낸 메일의 코드를 입력하세요.` : '이메일로 로그인 코드를 보내 드려요.'}
            </p>
          </div>

          {isCodeSent ? (
            <form onSubmit={verifyCode} className="space-y-6">
              <div>
                <label htmlFor="code" className="mb-2 block text-sm font-medium text-gray-700">로그인 코드</label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={FIELD}
                />
              </div>
              <Button type="submit" disabled={isBusy} className={SUBMIT}>로그인</Button>
              <Button
                type="button"
                variant="ghost"
                className={`${BUTTON} text-gray-700 hover:bg-gray-100 hover:text-gray-900`}
                onClick={() => { setIsCodeSent(false); setCode(''); setError('') }}
              >
                이메일 다시 입력
              </Button>
            </form>
          ) : (
            <form onSubmit={sendCode} className="space-y-6">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">이메일 주소</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={FIELD}
                />
              </div>
              <Button type="submit" disabled={isBusy} className={SUBMIT}>코드 받기</Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={signInWithGoogle}
                className={`${BUTTON} border-gray-300 bg-white text-gray-700 shadow-none hover:bg-gray-50 hover:text-gray-900`}
              >
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                구글로 계속하기
              </Button>
            </form>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </main>
    </div>
  )
}

// 서랍 하나가 열려 물건이 보이는 장식용 그림
function DrawerArt() {
  return (
    <svg viewBox="0 0 240 225" className="w-72" aria-hidden="true" fill="none" stroke="#44403c" strokeWidth="3" strokeLinecap="round">
      <ellipse cx="115" cy="214" rx="85" ry="7" fill="#e7e5e4" stroke="none" />
      <rect x="40" y="60" width="150" height="150" rx="8" fill="#fff" />
      <rect x="52" y="72" width="126" height="40" rx="4" />
      <line x1="105" y1="85" x2="125" y2="85" />
      <rect x="52" y="164" width="126" height="36" rx="4" />
      <line x1="105" y1="182" x2="125" y2="182" />
      <rect x="62" y="104" width="40" height="9" rx="4.5" fill="#fbbf24" />
      <circle cx="120" cy="106" r="7" />
      <line x1="127" y1="106" x2="145" y2="106" />
      <rect x="156" y="98" width="12" height="16" rx="2" fill="#a8a29e" />
      <rect x="34" y="114" width="162" height="46" rx="4" fill="#f5f5f4" />
      <line x1="105" y1="137" x2="125" y2="137" />
      <circle cx="205" cy="34" r="20" fill="#fff" />
      <text x="205" y="42" textAnchor="middle" fontSize="24" fontWeight="700" fill="#44403c" stroke="none">?</text>
    </svg>
  )
}
