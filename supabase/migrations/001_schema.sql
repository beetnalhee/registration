-- ============================================================================
-- 한여름 밤의 꿈 · 3분 데이트 신청 시스템 — 스키마
--
-- 정원 모델
--   하드 정원 : (회차, 성별) = 20명  → round_capacity.  총 3회차 × 2성별 × 20 = 120명
--   소프트 균형: (회차, 그룹, 성별) 카운트 → group_tally. 그룹 내 성비 보정에만 사용.
--
-- 정원 초과는 round_capacity 의 CHECK 제약으로 DB 레벨에서 구조적으로 불가능하다.
-- 배정은 서버가 pg_advisory_xact_lock 으로 직렬화한 트랜잭션 안에서만 수행한다.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── 열거형 ──────────────────────────────────────────────────────────────────
create type gender_code as enum ('M', 'F');
create type group_code as enum ('SUMMER', 'NIGHT');
create type participant_status as enum ('assigned', 'waitlisted', 'cancelled');
create type email_kind as enum ('assignment', 'waitlist', 'promotion', 'cancellation');
create type email_status as enum ('sent', 'failed');

-- ── 공통 트리거 함수 ────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 행사 설정 (단일 행) ─────────────────────────────────────────────────────
create table event_settings (
  id                  boolean       primary key default true check (id),
  event_name          text          not null default '한여름 밤의 꿈',
  -- 만나이 계산 기준일. 행사 당일로 설정한다.
  event_date          date          not null,
  -- false 이면 신청 접수를 전면 중단한다.
  is_open             boolean       not null default true,
  -- 이 비율 이상 차면 참가자 화면에 '마감 임박'으로 표시한다. 관리자가 변경 가능.
  near_full_threshold numeric(4, 3) not null default 0.800
                        check (near_full_threshold > 0 and near_full_threshold <= 1),
  -- 참가 가능 연령 (만나이). 범위를 벗어나면 신청이 거절된다.
  min_age             int           not null default 18 check (min_age >= 0),
  max_age             int           not null default 35 check (max_age >= min_age),
  -- Bridge Zone: 두 그룹 어디로도 배정될 수 있는 연령 구간. 참가자에게 노출 금지.
  bridge_min_age      int           not null default 24,
  bridge_max_age      int           not null default 27 check (bridge_max_age >= bridge_min_age),
  updated_at          timestamptz   not null default now()
);

create trigger event_settings_updated_at
  before update on event_settings
  for each row execute function set_updated_at();

comment on column event_settings.bridge_min_age is
  '내부 운영 규칙(Bridge Zone). 참가자에게 절대 노출하지 않는다.';

-- ── 그룹 (연령 규칙을 코드가 아닌 데이터로 관리) ────────────────────────────
create table groups (
  code         group_code primary key,
  display_name text       not null,
  min_age      int        not null,
  max_age      int        not null check (max_age >= min_age),
  sort_order   int        not null unique
);

comment on table groups is
  '그룹 코드는 연령대를 추측할 수 없는 중립적 이름을 사용한다(참가번호에 노출되므로).';

-- ── 회차 ────────────────────────────────────────────────────────────────────
create table rounds (
  id         uuid        primary key default gen_random_uuid(),
  round_no   int         not null unique check (round_no > 0),
  starts_at  time        not null,
  ends_at    time        not null check (ends_at > starts_at),
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ── 하드 정원: (회차, 성별) ────────────────────────────────────────────────
create table round_capacity (
  round_id     uuid        not null references rounds (id) on delete cascade,
  gender       gender_code not null,
  capacity     int         not null default 20 check (capacity >= 0),
  filled_count int         not null default 0 check (filled_count >= 0),
  updated_at   timestamptz not null default now(),
  primary key (round_id, gender),
  -- ★ 정원 초과 방지의 최종 안전장치. 애플리케이션 버그가 있어도 21번째는 커밋되지 않는다.
  constraint round_capacity_not_exceeded check (filled_count <= capacity)
);

create trigger round_capacity_updated_at
  before update on round_capacity
  for each row execute function set_updated_at();

-- ── 소프트 균형 + 참가번호 순번: (회차, 그룹, 성별) ────────────────────────
create table group_tally (
  round_id     uuid        not null references rounds (id) on delete cascade,
  group_code   group_code  not null references groups (code),
  gender       gender_code not null,
  -- 현재 유효 인원. 취소 시 감소하며 그룹 내 성비 보정 판단에 쓰인다.
  active_count int         not null default 0 check (active_count >= 0),
  -- 발급된 참가번호 순번. 취소되어도 절대 감소하지 않아 번호가 재사용되지 않는다.
  seq_counter  int         not null default 0 check (seq_counter >= 0),
  updated_at   timestamptz not null default now(),
  primary key (round_id, group_code, gender),
  constraint group_tally_active_le_issued check (active_count <= seq_counter)
);

create trigger group_tally_updated_at
  before update on group_tally
  for each row execute function set_updated_at();

-- ── 참가자 ──────────────────────────────────────────────────────────────────
create table participants (
  id                 uuid               primary key default gen_random_uuid(),

  -- 신청 정보
  name               text               not null check (length(btrim(name)) between 1 and 40),
  nickname           text               not null check (length(btrim(nickname)) between 1 and 20),
  birthdate          date               not null,
  gender             gender_code        not null,
  phone              text               not null,
  email              text               not null check (position('@' in email) > 1),

  -- 조회/중복 판정용 정규화 컬럼
  phone_digits       text               generated always as
                       (regexp_replace(phone, '\D', '', 'g')) stored,
  phone_last4        text               generated always as
                       (right(regexp_replace(phone, '\D', '', 'g'), 4)) stored,

  -- 내부 운영 정보 (참가자에게 노출 금지)
  age_at_event       int                not null check (age_at_event >= 0),
  default_group_code group_code         not null references groups (code),
  is_bridge_zone     boolean            not null default false,

  -- 희망 회차
  pref_1             int                not null,
  pref_2             int                not null,
  pref_3             int                not null,

  -- 배정 결과
  status             participant_status not null default 'assigned',
  assigned_round_id  uuid               references rounds (id),
  assigned_group_code group_code        references groups (code),
  sequence_no        int                check (sequence_no > 0),
  participant_code   text               unique,
  waitlisted_at      timestamptz,
  cancelled_at       timestamptz,

  created_at         timestamptz        not null default now(),
  updated_at         timestamptz        not null default now(),

  constraint prefs_distinct check (pref_1 <> pref_2 and pref_2 <> pref_3 and pref_1 <> pref_3),

  -- 배정된 참가자는 회차·그룹·순번·참가번호가 모두 있어야 한다.
  constraint assigned_row_is_complete check (
    status <> 'assigned' or (
      assigned_round_id is not null
      and assigned_group_code is not null
      and sequence_no is not null
      and participant_code is not null
    )
  ),
  -- 대기자는 배정 정보를 가질 수 없다.
  constraint waitlisted_row_has_no_slot check (
    status <> 'waitlisted' or (
      assigned_round_id is null
      and assigned_group_code is null
      and sequence_no is null
      and waitlisted_at is not null
    )
  )
);

create trigger participants_updated_at
  before update on participants
  for each row execute function set_updated_at();

-- 중복 신청 방지 (취소된 신청은 제외하여 재신청을 허용한다)
create unique index participants_active_email_uniq
  on participants (lower(email)) where status <> 'cancelled';

create unique index participants_active_phone_uniq
  on participants (phone_digits) where status <> 'cancelled';

-- ★ 조회 페이지 키(생년월일 + 전화 뒤 4자리)가 항상 1명만 가리키도록 보장한다.
create unique index participants_lookup_key_uniq
  on participants (birthdate, phone_last4) where status <> 'cancelled';

create index participants_status_idx on participants (status);
create index participants_assigned_idx on participants (assigned_round_id, assigned_group_code, gender);
create index participants_waitlist_order_idx on participants (waitlisted_at) where status = 'waitlisted';
create index participants_search_idx on participants (nickname, name);

-- ── 이메일 발송 로그 ────────────────────────────────────────────────────────
create table email_logs (
  id             uuid         primary key default gen_random_uuid(),
  participant_id uuid         not null references participants (id) on delete cascade,
  kind           email_kind   not null,
  to_address     text         not null,
  status         email_status not null,
  error_message  text,
  created_at     timestamptz  not null default now()
);

create index email_logs_participant_idx on email_logs (participant_id, created_at desc);

-- ── 관리자 (Supabase Auth 사용자 화이트리스트) ─────────────────────────────
create table admins (
  user_id      uuid        primary key,
  email        text        not null unique,
  display_name text,
  created_at   timestamptz not null default now()
);

comment on table admins is
  'Supabase Auth 로 로그인한 사용자 중 이 표에 있는 사람만 관리자 API 를 호출할 수 있다.';

-- ── 감사 로그 (관리자 변경 이력은 덮어쓰지 않고 누적한다) ──────────────────
create table audit_logs (
  id             uuid        primary key default gen_random_uuid(),
  admin_email    text        not null,
  action         text        not null,
  participant_id uuid        references participants (id) on delete set null,
  before_state   jsonb,
  after_state    jsonb,
  created_at     timestamptz not null default now()
);

create index audit_logs_created_idx on audit_logs (created_at desc);
create index audit_logs_participant_idx on audit_logs (participant_id, created_at desc);

-- ── RLS: 모든 표를 잠그고 정책을 만들지 않는다 ─────────────────────────────
-- 서버는 DATABASE_URL(postgres 역할)로 직접 접속하므로 영향받지 않는다.
-- Supabase 의 anon / authenticated 키로는 어떤 행도 읽거나 쓸 수 없다.
alter table event_settings  enable row level security;
alter table groups          enable row level security;
alter table rounds          enable row level security;
alter table round_capacity  enable row level security;
alter table group_tally     enable row level security;
alter table participants    enable row level security;
alter table email_logs      enable row level security;
alter table admins          enable row level security;
alter table audit_logs      enable row level security;

-- anon / authenticated 는 Supabase 가 만드는 역할이다.
-- 로컬 PostgreSQL 에서도 이 파일을 그대로 실행할 수 있도록 존재할 때만 회수한다.
do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on all tables in schema public from %I', role_name);
      execute format('revoke all on all sequences in schema public from %I', role_name);
      execute format('revoke all on all functions in schema public from %I', role_name);
    end if;
  end loop;
end
$$;
