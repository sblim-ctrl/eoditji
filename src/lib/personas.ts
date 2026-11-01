// 대화 상대별 화면 문구 (프로토타입 PERSONAS). 프롬프트 말투 조각은 supabase/functions/_shared/prompts.ts
// 두 상대의 키는 같아야 한다
import type { Persona } from '@shared/prompts.ts'

export type { Persona }

const MOM = {
  name: '엄마', hi: '밥은 먹었고?', title: '뭐 찾는 거 있어?',
  intro: '서랍 사진 한 장만 보여 주면 엄마가 다 기억해 둘게. 필요할 때 말로 물어봐.',
  inputLabel: '엄마에게 보낼 말', sheetTitle: '엄마가 기억하는 곳',
  count: (n: number) => (n ? `${n}곳 기억하는 중` : '아직 기억한 곳 없음'),
  emptyList: '아직 기억해 둔 곳이 없어. 서랍 사진부터 한 장 찍어 줘.',
  confirmDelete: '정말 지울까?',
  trouble: {
    rate_limited: '엄마가 좀 숨차다. 조금 있다가 다시 해 줘.',
    daily_limit: '오늘은 엄마가 많이 봐서 눈이 피곤하네. 내일 또 해 줘.',
    session_expired: '로그인이 풀렸대. 다시 로그인하고 와.',
    image_rejected: '이 사진은 엄마가 못 열겠어. 다른 사진으로 줄래?',
    default: '엄마가 잠깐 딴생각했네. 한 번만 다시 해 줄래?',
  } as Record<string, string>,
  askName: '여긴 어디 칸이야? 이름을 붙여 줘야 엄마가 안 헷갈리지.',
  askArea: '어느 방, 어느 가구에 있는 거야? 엄마가 사진 보는 동안 골라 줘.',
  looking: '어디 보자… 엄마가 꼼꼼히 볼게', searching: '가만있어 보자…', saving: '적어 두는 중…',
  cantRead: '지금은 엄마가 사진을 못 읽어. 안에 뭐 넣었는지 쉼표로 적어 줄래?',
  seeNothing: '어머, 엄마 눈엔 잘 안 보이네. 안에 뭐 있는지 쉼표로 적어 줄래?',
  draft: '이렇게 보이네. 잘못 본 건 눌러서 빼 줘.',
  lastAsk: '빠진 거 있으면 한 줄로 적어 줘. 쉼표로 나눠서.',
  needOne: '하나라도 적어 줘야 엄마가 기억하지.',
  written: '이렇게 적어 둘게.',
  saved: (place: string) => `알았어. ${place}, 엄마가 기억해 둘게.`,
  photoFail: '물건은 적어 뒀는데 사진을 못 올렸어. 다시 올려 볼까?',
  photoDone: '사진도 잘 올렸어.',
  tryIt: '서랍 앞에 있을 때 하나 물어봐. 엄마가 맞히나 보게.',
  anytime: '필요할 때 말로 물어봐.',
  later: '그래, 필요할 때 언제든 불러.',
  noPlaces: '아직 엄마한테 보여 준 데가 없잖아. 서랍 사진부터 한 장 찍어 줘.',
  notFound: '엄마는 그거 못 봤는데. 아직 안 보여 준 칸 아니야? 찾으면 그 칸 찍어 둘래?',
  other: '그래그래. 근데 뭐 찾는 거야? 물건 이름으로 물어봐.',
  foundAt: (item: string, place: string, inside: string | null) => `${item}? ${place}${inside ? `, ${inside} 안` : ''}에 있지.`,
  isThis: (item: string, place: string, inside: string | null) => `혹시 ${item} 말하는 거야? ${place}${inside ? `, ${inside} 안` : ''}에 있어.`,
  pick: '비슷한 게 여러 개네. 이 중에 뭐야?',
  fallback: '엄마가 지금 머리가 잘 안 돌아가서 글자만 보고 찾았어.',
  gotIt: '거봐, 엄마가 다 안다니까.',
  wrong: '어머, 엄마가 헷갈렸나 보다. 찾으면 그 칸 찍어 둘래? 엄마가 고쳐서 기억할게.',
  boxAsk: (item: string) => `${item}, 여기가 맞니?`,
  boxThanks: (item: string) => `${item}, 알겠어. 엄마가 기억해 둘게.`,
  boxUnknown: (item: string) => `${item}, 사진에서 어딘지는 엄마가 못 찾았어.`,
  hold: {
    listening: '듣고 있어. 말해 봐.', name: '어디 칸이야? 예) 왼쪽 첫째 서랍', area: '어디야? 예) 책상, 신발장',
    ask: '짧게 답해 줘. 예) 이어캡, 충전기', manual: '쉼표로 나눠 적어 줘. 예) 가위, 건전지, 줄자',
    idle: '엄마한테 물어봐. 예) 이어팁 어디 있어?',
  },
  noVoice: '여기선 엄마가 목소리를 못 듣네. 휴대폰 키보드에 있는 마이크 버튼을 눌러서 말해 줘.',
}

export type PersonaText = typeof MOM

const JARVIS: PersonaText = {
  name: 'EODI', hi: 'ONLINE · 대기 중', title: '무엇을 찾아 드릴까요?',
  intro: '수납칸 사진을 한 장 보여 주시면 안의 물건을 기록해 두겠습니다. 필요할 때 말씀만 하십시오.',
  inputLabel: 'EODI에게 보낼 말', sheetTitle: '기록된 구역',
  count: (n) => (n ? `${n}개 구역 기록됨` : '기록된 구역 없음'),
  emptyList: '기록된 구역이 없습니다. 수납칸 사진부터 보여 주십시오.',
  confirmDelete: '정말 삭제합니까?',
  trouble: {
    rate_limited: '요청이 잠시 몰렸습니다. 조금 뒤에 다시 시도해 주십시오.',
    daily_limit: '오늘 사용할 수 있는 분석 횟수를 모두 썼습니다. 내일 다시 이용해 주십시오.',
    session_expired: '로그인 세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주십시오.',
    image_rejected: '이 이미지는 분석할 수 없습니다. 다른 사진을 부탁드립니다.',
    default: '일시적인 오류입니다. 한 번 더 시도해 주시겠습니까?',
  },
  askName: '이 구역의 이름이 필요합니다. 어느 칸입니까?',
  askArea: '어느 공간에 있는 칸입니까? 분석하는 동안 골라 주십시오.',
  looking: '이미지 분석 중…', searching: '기록 대조 중…', saving: '기록 저장 중…',
  cantRead: '지금은 이미지 분석을 쓸 수 없습니다. 안에 든 물건을 쉼표로 나눠 입력해 주십시오.',
  seeNothing: '식별된 물건이 없습니다. 안에 든 물건을 쉼표로 나눠 입력해 주십시오.',
  draft: '분석 결과입니다. 잘못 식별한 항목은 눌러서 제외해 주십시오.',
  lastAsk: '누락된 물건이 있으면 쉼표로 나눠 입력해 주십시오.',
  needOne: '최소 한 개는 입력하셔야 기록할 수 있습니다.',
  written: '다음과 같이 기록합니다.',
  saved: (place) => `${place}, 기록을 마쳤습니다.`,
  photoFail: '물건 목록은 기록했지만 사진 업로드에 실패했습니다. 다시 올릴까요?',
  photoDone: '사진 업로드를 마쳤습니다.',
  tryIt: '시험 삼아 하나 물어봐 주십시오. 다른 이름으로 물으셔도 찾아 드리겠습니다.',
  anytime: '필요할 때 말씀만 하십시오.',
  later: '알겠습니다. 언제든 호출해 주십시오.',
  noPlaces: '아직 기록된 구역이 없습니다. 수납칸 사진부터 보여 주십시오.',
  notFound: '기록에 없는 물건입니다. 찾으시면 그 칸을 촬영해 두시겠습니까?',
  other: '알겠습니다. 찾으시는 물건의 이름을 말씀해 주십시오.',
  foundAt: (item, place, inside) => `찾았습니다. ${item}, ${place}${inside ? ` ${inside} 안` : ''}에 있습니다.`,
  isThis: (item, place, inside) => `${item}을 말씀하시는 겁니까? ${place}${inside ? ` ${inside} 안` : ''}에 있습니다.`,
  pick: '후보가 여러 개입니다. 어느 것입니까?',
  fallback: '분석 모듈이 응답하지 않아 글자 일치로만 찾았습니다.',
  gotIt: '기록이 정확했군요. 다행입니다.',
  wrong: '기록과 실제가 다르군요. 찾으시면 그 칸을 촬영해 두시겠습니까? 기록을 갱신하겠습니다.',
  boxAsk: (item) => `${item}, 여기가 맞나요?`,
  boxThanks: (item) => `${item}, 확인 감사합니다. 기록해 두겠습니다.`,
  boxUnknown: (item) => `${item}, 사진에서 위치를 특정하지 못했습니다.`,
  hold: {
    listening: '듣고 있습니다.', name: '구역 이름 예) 왼쪽 첫째 서랍', area: '공간 예) 책상, 신발장',
    ask: '짧게 입력 예) 이어캡, 충전기', manual: '쉼표로 구분 예) 가위, 건전지, 줄자',
    idle: '무엇이든 물어보십시오. 예) 이어팁 어디 있어?',
  },
  noVoice: '이 화면에서는 음성 입력이 막혀 있습니다. 휴대폰 키보드의 마이크 버튼으로 받아쓰기를 이용해 주십시오.',
}

export const PERSONAS: Record<Persona, PersonaText> = { mom: MOM, jarvis: JARVIS }

// 대화 상대와 상관없는 안내 (PRD 05 개인정보와 안전, D1 스파이크 결과)
export const PRIVACY_NOTE = '사진은 물건 목록을 만드는 데만 써요.'
export const SHOOT_TIP = '위에서 똑바로 찍어 주세요.'
