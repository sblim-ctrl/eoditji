# 어디있지?

넣어 둔 곳, 사진 한 장으로 기억해요. 서랍이나 수납장 한 칸을 찍어 두면 AI가 사진 속 물건 목록을 적어 두고, 나중에 "줄자 어디 뒀지?"처럼 다른 이름으로 물어도 그 칸과 사진을 찾아 줍니다.

- 배포: https://eoditji.vercel.app (휴대폰 권장. 구글 또는 이메일 코드 로그인)
- 문서: [PRD](docs/PRD.md) · [개발계획](docs/개발계획.md) · [프롬프트 기록](프롬프트.md) · [합성 이미지 실험](docs/합성이미지_실험.md)

## 왜 만들었나

가끔 쓰는 물건은 넣은 사람조차 위치를 기억하지 못해서, 필요할 때마다 집 안을 뒤지게 됩니다.

- 설문 20명 중 85%가 물건을 못 찾아 헤맨 적이 있고, 그중 53%는 15분 이상 걸렸습니다(못 찾고 포기한 3명을 넣으면 71%).
- 못 찾아서 다시 산 적이 있는 사람은 45%입니다.
- 지금 물건 위치를 기록하는 사람은 0명이었습니다. 기록하다 지친 게 아니라 기록할 계기가 없었습니다. 그래서 "정리하는 김에 사진 한 장"으로 기록 부담을 줄이는 데 집중했습니다.
- 대상: 계절 정리를 직접 하는 자취 2030 (자취 7명 모두 '내가 직접', 가족과 사는 13명 중 1명)

## 어떻게 쓰나

1. **찍기**: 칸을 위에서 찍어 올립니다. AI가 물건을 '확실 / 추정 / 가려짐'으로 나눠 초안을 만듭니다.
2. **확인하기**: 물건을 누르면 사진에 위치 박스가 보입니다. 틀린 이름·박스는 고치고, 가려진 곳은 몇 가지만 물어봅니다. 칸 이름과 공간(예: 책상)을 알려 주면 저장됩니다.
3. **찾기**: 말이나 글로 물어보면 그 칸의 사진, 박스, 찍은 날짜를 보여 줍니다. 확신이 낮으면 후보 칸을 고르게 하고, 기록에 없는 물건은 지어내지 않고 "못 봤다"고 답합니다. "찾았어!"를 누르면 그 질문을 다른 이름으로 배워, 다음에는 AI 없이 바로 답합니다.

- 대화 상대: 다정한 반말의 **엄마**와 정중한 **AI 비서** 중에 고릅니다.
- 그룹: 초대 링크로 가족과 기록을 같이 쓰고, 칸마다 "나만 보기"로 숨길 수 있습니다.

## 평가 결과 (11/2)

찾기 질문 30건('다른 이름' 질문 11건, 기록에 없는 물건 질문 포함)을 버전별로 5번씩 돌렸습니다.

| 검색 방식 | 정답 서랍 일치 | '다른 이름' 질문 | 지어낸 답 | 1회 비용 |
|---|---|---|---|---|
| v0 키워드 | 66.7% | 36.4% | 0건 | $0 |
| v1 기록 전체를 LLM에 | 100% | 100% | 0건 | $0.00061 |
| **v3 단계별 (지금 쓰는 방식)** | **100%** (5회 모두) | **100%** | **0건** | **$0.000147** |

- 정답 서랍 일치율은 66.7%(키워드)에서 100%로 올랐고, 검색 1회 비용은 기록 전체를 넣는 방식보다 75.9% 줄었습니다.
- 단계별 검색: 0단계(이름이나 배운 다른 이름과 정확히 같으면 AI 없이 답) → 1단계(DB에서 비슷한 후보 20개) → 2단계(작은 모델이 후보 중에서 고름).
- v2에서 틀린 2건이 모두 '여러 물건을 한꺼번에 묻는 질문'이어서 프롬프트에 규칙 한 줄을 더한 것이 v3입니다. 같은 30건으로 실패를 보고 다시 쟀기 때문에, 새 질문에서도 같은 수치가 나온다고 보장하지는 않습니다.

| 인식·위치·운영 | 값 | 기준 | 판정 |
|---|---|---|---|
| 보이는 물건 인식률 (실제 서랍 사진 10장, 79개) | 77.2% | ≥ 80% | 미달 (짝짓기 판정이 보수적이라 하한) |
| 박스 적중률 (IoU ≥ 0.5) | 72.2%, AI가 찾은 물건만 보면 93.4% | ≥ 60% | 통과 |
| 칸 1개 기록 비용 | $0.0055 | ≤ $0.01 | 통과 |
| 인식 p95 지연 | 14.9초 | ≤ 12초 | 미달 (물건 13개 이상인 칸에서만 넘음) |
| 검색 AI 단계 p95 지연 | 1.9초 | ≤ 3초 | 통과 (표본 3건) |

- 사진 크기는 1400px로 정했습니다. 1024px보다 인식률이 8.8%p 높고 비용 차이는 1회 $0.0005입니다.
- 인식 모델을 작은 모델(luna)로 바꾸면 비용은 1/9이지만 인식률이 50.6%로 떨어져 바꾸지 않았습니다.
- 사용자 테스트는 시간이 없어 하지 못했습니다. "사람이 정리하는 날 실제로 기록해 줄까"는 검증하지 못한 가정으로 남아 있습니다.
- 자세한 수치와 한계: [PRD 03 평가 결과](docs/PRD.md#평가-결과-112)

## 이상한 입력과 실패를 막는 방법

| 상황 | 막는 방법 |
|---|---|
| 기록에 없는 물건을 물음 | 구조화 출력으로 후보 id만 고르게 하고, 후보 밖의 id는 서버가 거절. 평가에서 지어낸 답 0건 |
| AI가 잘못된 박스를 냄 | 박스를 0~1000으로 자르고, 뒤집히거나 넓이가 0이면 버림 |
| AI 호출 실패·하루 한도 초과 | 검색은 키워드 검색으로 대신 찾고 그렇다고 알림. 인식은 상대 말투로 안내하고 다시 하기 버튼. 하루 한도는 인식 20회, 검색 100회 |
| 남의 기록·사진 | Postgres RLS로 같은 그룹 멤버만 읽음. 사진은 비공개 저장소에 두고 서명 URL로만 보여 줌. 초대 코드는 7일 뒤 만료 |
| 사진 데이터 | OpenAI에 `store: false`로 보내고 학습에 쓰지 않음. 처리 위치와 보관은 [개인정보처리방침](https://eoditji.vercel.app/privacy.html)에 적음 |
| 빈 화면 | 기록이 없으면 첫 칸 찍기를, 찾지 못하면 그 칸 찍기나 기억해 둔 곳 보기를 권함 |

권한 검사는 `npm run rls-check`(44개 항목), 함수 검사는 `npm run functions-check`로 확인합니다.

## 구조

```
브라우저 (Vite + React 19 + TypeScript, Tailwind, shadcn)
  ├─ Supabase Auth (구글, 이메일 코드)
  ├─ Postgres + RLS (groups, places, items, item_labels, events …), Storage 'photos'
  └─ Edge Functions (Deno)
       ├─ recognize: 사진 → gpt-6.1-terra → 확실/추정/가려짐 + 박스 + 다른 이름
       └─ search: 0단계 정확히 일치 → 1단계 pg_trgm 후보 20개 → 2단계 gpt-6-luna
```

| 폴더 | 내용 |
|---|---|
| `src/features/` | `chat`(대화 흐름), `photo`(박스 편집기), `places`(기억해 둔 곳·칸 상세), `groups`(그룹·초대), `auth`, `landing` |
| `supabase/functions/_shared/` | 프롬프트(`prompts.ts`), 결과 검증(`validate.ts`), 0단계 일치(`match.ts`), OpenAI 호출 |
| `supabase/migrations/` | 테이블, RLS, RPC (`0001`~`0009`) |
| `eval/` | 인식·검색·박스 평가 스크립트 |
| `scripts/` | RLS·함수 검사, 운영 지표 SQL(`metrics.sql`) |

## 직접 실행하기

필요한 것: Node 20+, [Deno](https://deno.com) 2+, [Supabase CLI](https://supabase.com/docs/guides/cli), Supabase 프로젝트 하나, OpenAI API 키

```bash
git clone https://github.com/sblim-ctrl/eoditji.git && cd eoditji
npm install
cp .env.example .env   # 값 채우기 (아래)

# Supabase: 테이블·RLS를 만들고, 함수와 서버 비밀 값을 올림
set -a; . ./.env; set +a
supabase link --project-ref <프로젝트 ref>
supabase db push --linked
supabase secrets set OPENAI_API_KEY=<키>
supabase functions deploy recognize
supabase functions deploy search

npm run dev            # http://localhost:5173
```

- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 브라우저에 공개돼도 되는 값입니다. `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`는 검사·평가 스크립트와 CLI에서만 쓰고 절대 `VITE_`를 붙이지 않습니다.
- Supabase 대시보드 Authentication에서 Email(코드 로그인)과, 쓰려면 Google 로그인을 켜고 Redirect URL에 `http://localhost:5173`과 배포 주소를 넣습니다.
- 검사: `npm test`(Deno 단위 테스트), `npm run rls-check`, `npm run functions-check`(임시 계정을 만들고 지움)
- 평가: `npm run eval:recognize -- --size 1400`, `npm run eval:search -- --variant v3 --repeat 5`, `npm run eval:box`. 평가에 쓴 실제 집 사진과 정답표(`eval/photos/`, `eval/photo_truth.csv`, `eval/questions.csv`)는 개인 정보라 저장소에 없습니다. 같은 형식의 파일을 만들어 넣으면 돌아갑니다.
