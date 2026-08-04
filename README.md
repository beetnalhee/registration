# 사랑은 돌아오는 거야 · 3분 데이트 신청 시스템

교회 행사용 3분 데이트 신청 및 **자동 배정** 시스템입니다.
참가자가 신청하면 서버가 즉시 회차·그룹을 배정하고, 결과를 화면과 이메일로 안내합니다.

```
신청 → 자동 배정(서버) → 화면 즉시 표시 → 이메일 자동 발송
```

## 목차

- [핵심 규칙](#핵심-규칙)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [Supabase 설정](#supabase-설정)
- [Vercel 배포](#vercel-배포)
- [테스트](#테스트)
- [문서](#문서)
- [운영 체크리스트](#운영-체크리스트)

## 핵심 규칙

| 항목 | 값 |
|---|---|
| 회차 | 3회차 (21:40~22:00 / 22:05~22:25 / 22:30~22:50) |
| 정원 | **회차 × 그룹 × 성별 = 10명** → 3×2×2×10 = 총 120명 |
| 그룹 | `SUMMER` / `NIGHT` (연령대를 추측할 수 없는 중립적 이름) |
| 참가번호 | `SUMMER-2-F-013` = 그룹-회차-성별-순번 |
| 참가 연령 | 만 18~35세 |
| 회차 선택 | **1개만 선택 (선착순)** — 마감된 회차는 신청 불가, 대기자 제도 없음 |
| 본인 조회·취소 키 | 이메일 + 전화번호 뒤 4자리 |

### 참가자에게 보여주지 않는 것

요구사항의 가장 중요한 제약입니다. 다음은 **어떤 API 응답에도 포함되지 않습니다.**

- 남녀 인원수, 잔여석, 신청 인원
- 그룹의 연령 구간
- Bridge Zone(경계 연령 참가자를 다른 그룹으로 이동시키는 내부 규칙)

참가자가 회차에 대해 볼 수 있는 정보는 다음 세 문자열뿐입니다.

```
✅ 신청 가능    🔥 마감 임박    ❌ 마감
```

`마감 임박` 기준(기본 80%)은 관리자 페이지에서 변경할 수 있습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | React 18, TypeScript, Tailwind CSS, Vite, React Router |
| 백엔드 | Node.js, Express, TypeScript (Vercel Serverless Function) |
| 데이터베이스 | Supabase (PostgreSQL) — `pg` 로 직접 접속 |
| 인증 | Supabase Auth (관리자만) |
| 이메일 | Nodemailer + Gmail SMTP |
| 테스트 | Vitest (단위 + 실제 PostgreSQL 통합 테스트) |
| 배포 | Vercel |

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 준비
cp .env.example .env
#   → DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY 를 채웁니다.
#   → 이메일 설정(GMAIL_*)이 없으면 발송을 건너뛰고 콘솔에만 남깁니다.

# 3) 개발 서버 (프론트 5173 + API 3001 동시 실행)
npm run dev
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 프론트엔드 + API 서버 동시 실행 |
| `npm run build` | 타입 검사 후 프로덕션 빌드 |
| `npm run typecheck` | 서버·프론트 타입 검사 |
| `npm test` | 테스트 실행 |
| `npm run test:coverage` | 커버리지 측정 |

### 화면

| 경로 | 설명 |
|---|---|
| `/` | 랜딩 — 행사 소개, 회차 상태 |
| `/apply` | 신청 (3단계: 기본 정보 → 회차 선택 → 확인). 마감 회차는 선택 불가 |
| `/apply/complete` | 배정 결과 |
| `/lookup` | 본인 조회 및 **신청 취소** |
| `/admin/login` | 운영진 로그인 |
| `/admin` | 실시간 현황판 + 행사 설정 |
| `/admin/reception` | 리셉션 출석 체크 (검색 → 출석, 회차별 카운터, 미도착자 필터) |
| `/admin/participants` | 참가자 검색·상세·회차/그룹 변경·취소·CSV·이메일 재발송 |

## Supabase 설정

### 1. 스키마 생성

Supabase 대시보드 > SQL Editor 에서 순서대로 실행합니다.

```
supabase/migrations/001_schema.sql
supabase/migrations/002_seed.sql
supabase/migrations/003_attendance.sql
supabase/migrations/004_single_round_and_lookup_key.sql
supabase/migrations/005_group_capacity.sql
```

> 이미 앞선 마이그레이션을 실행한 뒤라면 새 파일만 번호 순서대로 실행하면 됩니다.
> `004` 는 희망 회차 컬럼(`pref_1~3`)을 단일 컬럼으로 옮기고,
> `005` 는 정원 단위를 (회차, 그룹, 성별) 10명으로 바꿉니다.
> 둘 다 기존 데이터를 이관하므로 순서대로만 실행하면 됩니다.

> ⚠️ `002_seed.sql` 의 `event_date` 를 **실제 행사 당일**로 바꿔주세요.
> 만나이 계산 기준일이므로 이 값이 틀리면 그룹 배정이 어긋납니다.
> (관리자 현황판에서도 변경할 수 있습니다)

### 2. 관리자 계정 등록

인증은 Supabase Auth 가, 인가는 `admins` 표가 담당합니다.
계정이 있어도 `admins` 에 없으면 관리자 API 를 호출할 수 없습니다.

1. Authentication > Users > **Add user** (Auto Confirm User 체크)
2. 생성된 User UID 를 복사해 SQL Editor 에서 실행

```sql
insert into admins (user_id, email, display_name)
values ('붙여넣은-uuid', 'admin@example.com', '운영자');
```

### 3. 연결 문자열

Project Settings > Database > Connection string > **Transaction pooler (port 6543)** 를 사용합니다.
배정이 `pg_advisory_xact_lock`(트랜잭션 범위 락)을 쓰므로 transaction pooler 에서 안전합니다.

```
postgresql://postgres.xxxx:PASSWORD@aws-0-....pooler.supabase.com:6543/postgres?sslmode=require
```

`?sslmode=require` 를 반드시 붙이세요. SSL 사용 여부는 이 문자열로만 결정됩니다.

### RLS

모든 표에 RLS 를 켜고 정책을 만들지 않았습니다.
서버는 `DATABASE_URL`(postgres 역할)로 직접 접속하므로 영향이 없고,
Supabase 의 anon / authenticated 키로는 어떤 행도 읽거나 쓸 수 없습니다.
프론트엔드에는 Supabase 키를 아예 넣지 않습니다.

## Vercel 배포

1. GitHub 저장소를 Vercel 에 연결합니다 (Framework Preset: **Vite**)
2. Settings > Environment Variables 에 `.env.example` 의 항목을 모두 등록합니다
3. Deploy

`vercel.json` 이 `/api/*` 요청을 `api/index.ts`(Express 앱)로 보내고,
나머지는 SPA 로 폴백합니다.

### Gmail 앱 비밀번호

일반 계정 비밀번호로는 SMTP 인증이 되지 않습니다.
2단계 인증을 켠 뒤 [앱 비밀번호](https://myaccount.google.com/apppasswords) 16자리를 발급해 `GMAIL_APP_PASSWORD` 에 넣으세요.

> Gmail 무료 계정은 하루 발송량 제한이 있습니다(약 500통). 120명 규모에는 충분합니다.

## 테스트

```bash
# 단위 테스트 (DB 불필요)
npm test

# 통합 테스트 포함 — 실제 PostgreSQL 필요
docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres --name midsummer-test postgres:16
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/postgres npm test
docker stop midsummer-test
```

`TEST_DATABASE_URL` 이 없으면 통합 테스트는 자동으로 건너뜁니다.
통합 테스트는 스키마를 다시 만들기 때문에 **운영 DB 를 절대 가리키지 마세요.**
그래서 `DATABASE_URL` 이 아닌 별도 변수를 요구합니다.

### 검증되는 것

- 20명이 동시에 같은 그룹·성별·회차를 신청 → **정확히 10명만 배정**, 나머지는 거절 (다른 회차·그룹으로 넘기지 않음)
- 어떤 (회차, 그룹, 성별) 조합도 10명을 넘지 않음
- 경계 연령은 기본 그룹이 차면 반대 그룹으로 배정되어 참가 가능
- 그룹·성별 정원이 서로를 잠식하지 않음
- 참가번호 중복 없음, 취소된 번호 재사용 없음
- 취소 시 자리 반납 → 다음 사람이 신청 가능
- 참가자용 응답에 인원수·정원·Bridge Zone 문자열이 없음

## 문서

| 문서 | 내용 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 아키텍처, 폴더 구조, ERD, 인증 구조 |
| [docs/assignment-algorithm.md](docs/assignment-algorithm.md) | 배정 알고리즘, 동시성 처리, Bridge Zone |
| [docs/api.md](docs/api.md) | API 명세 |
| [docs/operations.md](docs/operations.md) | 행사 당일 운영 가이드 |

## 운영 체크리스트

행사 전날까지 확인하세요.

- [ ] `event_settings.event_date` 가 실제 행사 당일인지 (만나이 계산 기준)
- [ ] 회차 시간이 실제 일정과 맞는지
- [ ] 관리자 계정으로 `/admin` 로그인이 되는지
- [ ] 테스트 신청 1건으로 이메일이 실제 도착하는지 (스팸함도 확인)
- [ ] 테스트 신청을 관리자 페이지에서 취소해 정리했는지
- [ ] 마감 임박 기준(기본 80%)이 원하는 값인지
- [ ] 접수 시작 직전까지 `접수 중단` 상태로 두었는지
