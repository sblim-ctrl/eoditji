import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { rememberJoinCode } from '@/features/groups/useGroups'

rememberJoinCode() // 초대 링크의 코드를 로그인 전에 챙김

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
