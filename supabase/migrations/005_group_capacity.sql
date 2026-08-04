-- ============================================================================
-- 005 · 정원을 (회차, 그룹, 성별) 10명으로, 대기자 폐지
--
-- 이전 모델
--   하드 정원 : (회차, 성별) 20명        → round_capacity
--   소프트 균형: (회차, 그룹, 성별) 카운트 → group_tally
--
-- 새 모델
--   하드 정원 : (회차, 그룹, 성별) 10명  → round_slots (기존 group_tally 를 승격)
--   3회차 × 2그룹 × 2성별 × 10 = 120명 (총원은 그대로)
--
-- 표를 하나로 합칠 수 있게 되었다. 그룹별 정원이 하드 제약이 되면서
-- (회차, 성별) 합계 20명은 자동으로 따라오기 때문이다.
--
-- 대기자는 폐지한다. 마감이면 신청 불가이고, 취소로 자리가 나면
-- 그 시점에 신청하는 사람이 가져간다.
-- participant_status 의 'waitlisted' 값은 PostgreSQL 에서 열거형 값을
-- 안전하게 제거할 수 없어 남겨두지만, 애플리케이션은 더 이상 생성하지 않는다.
--
-- 이 파일은 여러 번 실행해도 안전하다.
-- ============================================================================

-- ── 1) 이름 변경: 이제 단순 집계가 아니라 정원 표다 ────────────────────────
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'group_tally')
     and not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'round_slots')
  then
    alter table group_tally rename to round_slots;
  end if;
end
$$;

-- ── 2) 정원 컬럼과 제약 ────────────────────────────────────────────────────
alter table round_slots
  add column if not exists capacity int not null default 10;

alter table round_slots
  drop constraint if exists group_tally_not_exceeded;

alter table round_slots
  drop constraint if exists round_slots_not_exceeded;

-- ★ 정원 초과 방지의 최종 안전장치.
--   애플리케이션에 버그가 있어도 11번째는 커밋되지 않는다.
alter table round_slots
  add constraint round_slots_not_exceeded check (active_count <= capacity);

comment on table round_slots is
  '(회차, 그룹, 성별) 단위 정원. active_count 는 취소 시 감소하고, seq_counter 는 감소하지 않아 참가번호가 재사용되지 않는다.';

comment on column round_slots.capacity is
  '이 (회차, 그룹, 성별) 조합에 받을 수 있는 최대 인원. 기본 10명.';

-- ── 3) (회차, 성별) 정원 표는 불필요해졌다 ─────────────────────────────────
-- 그룹별 정원이 하드 제약이므로 회차·성별 합계는 자동으로 20명이 된다.
drop table if exists round_capacity;

-- ── 4) 대기자로 남아 있던 신청 정리 ────────────────────────────────────────
-- 대기자 개념이 없어졌으므로 남아 있으면 어느 화면에서도 다룰 수 없는 상태가 된다.
-- (좌석을 점유하지 않았으므로 정원 카운터는 건드리지 않는다)
update participants
   set status = 'cancelled', cancelled_at = now()
 where status = 'waitlisted';
