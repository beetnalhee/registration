# 아키텍처

## 전체 구조

```
┌──────────────────┐   HTTPS    ┌──────────────────────┐   pg (TLS)  ┌────────────┐
│  React SPA       │ ─────────► │  Express             │ ──────────► │  Supabase  │
│  (Vite, Vercel   │  결과만     │  (Vercel Serverless) │  트랜잭션    │ PostgreSQL │
│   정적 호스팅)    │            │                      │             └────────────┘
└──────────────────┘            └──────────┬───────────┘
                                           │ SMTP (465)
                                           ▼
                                  Nodemailer / Gmail
```

### 설계 원칙

1. **배정은 서버만 수행한다.** 클라이언트는 정원·성비·연령 규칙을 알지 못하고 계산할 수도 없다.
2. **참가자 응답에는 운영 정보를 담지 않는다.** 회차 상태조차 서버가 문자열로 계산해 내려준다.
3. **정원 초과는 두 겹으로 막는다.** advisory lock 으로 직렬화하고, DB CHECK 제약으로 커밋 자체를 거부한다.
4. **순수 로직과 I/O 를 분리한다.** 배정 알고리즘은 DB·HTTP·시간·난수를 모르는 순수 함수라 전수 테스트가 가능하다.

## 폴더 구조

```
registration/
├─ api/
│  └─ index.ts                  Vercel Serverless 진입점 (Express 앱을 export)
│
├─ server/                      백엔드
│  ├─ app.ts                    라우터·미들웨어 조립
│  ├─ dev.ts                    로컬 개발용 서버 (Vercel 배포 시 미사용)
│  ├─ errors.ts                 AppError + PG 오류 코드
│  │
│  ├─ config/
│  │  ├─ env.ts                 환경 변수 zod 검증 (부팅 시 1회)
│  │  └─ policy.ts              락 키, 성비 가중치, 요청 제한, 풀 설정
│  │
│  ├─ domain/                   ★ 순수 로직 (DB·HTTP 의존성 0)
│  │  ├─ age.ts                 만나이 계산, 참가 가능 연령 판정
│  │  ├─ group.ts               나이 → 그룹, Bridge Zone 판정
│  │  ├─ assignment.ts          배정 결정, 그룹 선택 스코어링
│  │  ├─ availability.ts        회차 상태 계산
│  │  ├─ participantCode.ts     참가번호 생성
│  │  └─ types.ts
│  │
│  ├─ repositories/             데이터 접근 (Queryable 을 받아 풀/트랜잭션 무관)
│  │  ├─ settingsRepository.ts
│  │  ├─ roundRepository.ts
│  │  ├─ slotRepository.ts      정원 점유·반납, 순번 발급
│  │  ├─ participantRepository.ts
│  │  ├─ emailLogRepository.ts
│  │  ├─ auditLogRepository.ts
│  │  └─ adminRepository.ts
│  │
│  ├─ services/                 유스케이스
│  │  ├─ applicationService.ts  ★ 신청 접수 + 배정
│  │  ├─ lookupService.ts
│  │  ├─ selfCancelService.ts   본인 취소 (관리자 취소 경로를 재사용)
│  │  ├─ availabilityService.ts
│  │  ├─ authService.ts
│  │  ├─ eventContextService.ts
│  │  ├─ dto.ts                 ★ 참가자용/관리자용 응답 변환 (정보 차단 지점)
│  │  └─ admin/
│  │     ├─ overviewService.ts
│  │     ├─ participantQueryService.ts     목록·상세·CSV
│  │     ├─ participantMutationService.ts  변경·취소·재발송
│  │     └─ settingsAdminService.ts
│  │
│  ├─ email/
│  │  ├─ mailer.ts              Mailer 인터페이스 + ConsoleMailer
│  │  ├─ nodemailerMailer.ts    Gmail SMTP 구현
│  │  ├─ templates.ts           HTML/텍스트 메일 템플릿
│  │  └─ notificationService.ts 발송 + 로그 기록 (절대 예외를 던지지 않음)
│  │
│  ├─ db/
│  │  ├─ pool.ts                커넥션 풀, withTransaction
│  │  └─ lock.ts                pg_advisory_xact_lock
│  │
│  ├─ http/
│  │  ├─ respond.ts             성공/실패 응답 봉투
│  │  ├─ asyncHandler.ts
│  │  └─ middleware/
│  │     ├─ errorHandler.ts     zod/AppError/예상 못한 오류 처리
│  │     ├─ requireAdmin.ts     Bearer 토큰 검증 + admins 화이트리스트
│  │     ├─ rateLimiters.ts     신청·조회·로그인 요청 제한
│  │     └─ securityHeaders.ts
│  │
│  └─ routes/
│     ├─ publicRoutes.ts        참가자용 (신청·조회·본인취소)
│     └─ adminRoutes.ts         관리자용
│
├─ shared/                      프론트·백엔드 공용
│  ├─ constants.ts              참가자에게 노출되는 값만
│  ├─ types.ts                  DTO 타입
│  ├─ schemas.ts                zod 검증 스키마 (양쪽이 같은 규칙을 사용)
│  └─ format.ts                 시간·전화번호 표기
│
├─ src/                         프론트엔드
│  ├─ App.tsx                   라우팅
│  ├─ pages/                    화면
│  ├─ components/
│  │  ├─ ui/                    디자인 시스템 (NightSky, Button, Field, …)
│  │  ├─ apply/                 신청 단계별 컴포넌트 + 폼 상태
│  │  ├─ result/                배정 결과 카드
│  │  └─ admin/                 현황판·설정·참가자 상세
│  ├─ hooks/useAsync.ts
│  ├─ lib/                      API 클라이언트, 세션·결과 저장
│  └─ styles/index.css
│
├─ supabase/migrations/         001~005 (스키마·시드·출석·선착순·그룹정원)
├─ tests/
│  ├─ domain/                   단위 테스트
│  ├─ shared/                   검증 스키마 테스트
│  └─ integration/              실제 PostgreSQL 통합 테스트
└─ docs/
```

## ERD

```
event_settings (단일 행)
  ├─ event_date            만나이 계산 기준일
  ├─ is_open               접수 여부
  ├─ near_full_threshold   '마감 임박' 표시 기준 (기본 0.8)
  ├─ min_age / max_age     참가 가능 연령
  └─ bridge_min_age / bridge_max_age   ← 내부 규칙 (비노출)

groups
  code (SUMMER | NIGHT), min_age, max_age, sort_order
  └─ 연령 구간을 코드가 아닌 데이터로 관리 → 운영 중 조정 가능

rounds
  round_no, starts_at, ends_at, is_active
  │
  └──< round_slots      (round_id, group_code, gender)  ★ 하드 정원
         capacity=10
         active_count  현재 인원 (취소 시 감소)
         seq_counter   발급 순번 (절대 감소하지 않음) → 참가번호 재사용 방지
         CHECK (active_count <= capacity)   ← 정원 초과 구조적 차단

participants
  신청 정보 : name, birthdate, gender, phone, email
  정규화    : phone_digits, phone_last4 (생성 컬럼)
  내부 정보 : age_at_event, default_group_code, is_bridge_zone   ← 비노출
  선택      : preferred_round_no  (선착순이므로 대체 순위 없음)
  결과      : status, assigned_round_id, assigned_group_code,
              sequence_no, participant_code, waitlisted_at, cancelled_at,
              checked_in_at
  │
  ├──< email_logs    발송 이력 (재발송 판단 근거)
  └──< audit_logs    관리자 변경 이력 (before/after jsonb)

admins
  user_id (auth.users), email, display_name
```

### 유니크 인덱스

| 인덱스 | 목적 |
|---|---|
| `participants_active_email_uniq` | 이메일 중복 신청 차단 (취소 건 제외 → 재신청 허용) |
| `participants_active_phone_uniq` | 연락처 중복 신청 차단 |
| `participants.participant_code` | 참가번호 중복 차단 |

### 정원을 그룹 단위로 끊은 이유

하드 정원은 `(회차, 그룹, 성별)` 단위 **10명**입니다. 3회차 × 2그룹 × 2성별 × 10 = 120명.

3분 데이트는 **같은 그룹끼리** 짝을 지으므로 그룹마다 인원을 통제해야 짝이 남지 않습니다.
그룹별 정원이 하드 제약이면 `(회차, 성별)` 합계 20명은 자동으로 따라오므로 표가 하나로 충분합니다.

이 모델의 귀결 두 가지가 설계 전반에 영향을 줍니다.

1. **회차 상태를 계산하려면 참가자의 그룹을 알아야 합니다.** 그룹은 나이로 정해지므로
   `/api/rounds/availability` 가 생년월일을 받아 서버에서 계산합니다.
   URL 에 생년월일이 남지 않도록 POST 를 씁니다.
2. **Bridge Zone 이 참가 가능 여부를 가릅니다.** 경계 연령은 기본 그룹이 마감이어도
   반대 그룹에 자리가 있으면 참가할 수 있습니다.

## 인증 · 권한 구조

```
관리자 로그인
  ─► POST /api/admin/login (email, password)
      └─ Supabase Auth signInWithPassword   ← 비밀번호 해싱·토큰 서명은 Supabase 담당
          └─ admins 표에 user_id 존재 확인   ← 인가는 우리 DB 담당
              └─ access_token 반환 (sessionStorage 보관)

이후 모든 관리자 요청
  ─► Authorization: Bearer <token>
      └─ requireAdmin 미들웨어
          ├─ Supabase getUser(token) 로 검증
          └─ admins 조회 → res.locals.admin
```

- 자체 암호화 코드를 쓰지 않아 암호학적 실수 여지가 없습니다.
- **인증(Supabase)과 인가(admins 표)를 분리**했으므로 계정만 만들어도 권한은 얻지 못합니다.
- 토큰은 `sessionStorage` 에만 두어 탭을 닫으면 사라집니다(공용 PC 대비).
- 프론트엔드의 라우트 가드는 편의 장치일 뿐이고, 실제 차단은 서버가 합니다.
- 참가자는 인증이 없습니다. 대신 조회 API 에 IP 기준 요청 제한(분당 10회)을 겁니다.
- 본인 조회·취소 자격증명은 **이메일 + 전화번호 뒤 4자리**입니다. 취소는 파괴적이므로
  분당 3회로 더 촘촘히 제한합니다. 생년월일을 쓰지 않는 이유는 지인이 알기 쉬워
  취소 권한을 주기에 부적절하기 때문입니다.

## 정보 차단 지점

참가자에게 운영 정보가 새지 않도록 다음 세 곳에서 차단합니다.

| 위치 | 역할 |
|---|---|
| `server/services/dto.ts` | 참가자용 DTO 변환 시 나이·기본그룹·Bridge Zone 플래그를 떨어뜨린다 |
| `server/services/availabilityService.ts` | 인원수를 상태 문자열로 바꿔서만 반환한다 |
| `server/errors.ts` | 오류 메시지에 내부 규칙·정원 수치를 넣지 않는다 |

통합 테스트가 참가자용 응답에 `filled` / `capacity` / `bridge` 같은 문자열이 없는지 직접 검사합니다.

## 이메일 발송 구조

```
배정 트랜잭션 COMMIT
      │
      ▼
notifyParticipant()   ← 트랜잭션 밖에서 호출 (메일 지연이 락을 붙잡지 않도록)
      ├─ 성공 → email_logs (status='sent')
      └─ 실패 → email_logs (status='failed', error_message)
                 └─ 신청은 그대로 성공 처리, 관리자가 재발송 가능
```

`Mailer` 인터페이스에만 의존하므로 공급자를 바꾸거나 테스트에서 가짜 구현을 끼울 수 있습니다.
환경 변수에 Gmail 설정이 없으면 `ConsoleMailer` 가 콘솔에만 남깁니다(로컬 개발).

## 화면 설계

```
/                랜딩 — 히어로, 회차 상태(3상태만), 진행 안내
/apply           신청
  step 1         생년월일·성별 — 회차 상태 계산에 필요한 값만 먼저 받는다
  step 2         회차 1개 선택 (선착순, 마감 회차는 선택 불가)
  step 3         이름·연락처·이메일
  step 4         입력 확인 → 제출
/apply/complete  배정 결과 (그룹·회차·시간·장소·참가번호) — sessionStorage 로 전달
/lookup          이메일 + 전화 뒤 4자리 → 본인 배정 조회 및 신청 취소
/admin/login     운영진 로그인
/admin           현황판 (15초 자동 갱신) + 행사 설정
/admin/participants  검색·필터·상세·배정변경·취소·승격·CSV·이메일 재발송
```

### 디자인 시스템

청춘 남녀의 한여름 밤, 설레는 분위기. 야간 행사이므로 다크 톤 고정입니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `midnight` | `#070B1C` ~ `#26386F` | 밤하늘 배경 그라데이션 |
| `moonlight` | `#FFD98E` | 달빛 — 주 강조색, 참가번호 |
| `peach` | `#FFB3C1` | 설렘 — 대기·경고 |
| `glow` | `#7DD3FC` | 새벽빛 — 보조 강조 |

- 배경: `NightSky` 컴포넌트가 결정적 난수로 별 64개를 배치하고 CSS 키프레임으로 반짝이게 함 (JS 애니메이션 라이브러리 없음)
- 카드: 글래스모피즘 (`backdrop-blur` + 반투명 배경)
- 서체: 본문 Pretendard, 제목 나눔명조
- 모바일 우선. 입력 확대를 막기 위해 입력 요소 최소 16px, `env(safe-area-inset-bottom)` 반영
