-- ============================================================================
-- 출석 체크 (리셉션)
--
-- 출석 여부를 status 에 넣지 않고 별도 컬럼으로 둔다.
-- 배정 상태와 출석은 서로 독립적인 정보이기 때문이다.
--   · 배정되었지만 오지 않은 사람(노쇼) → status='assigned', checked_in_at is null
--   · 배정되어 참석한 사람             → status='assigned', checked_in_at 있음
-- 한 컬럼에 섞으면 "취소했는데 출석" 같은 모순 상태를 표현할 수 있게 되고,
-- 노쇼 집계(배정 O + 출석 X)를 뽑을 수 없다.
-- ============================================================================

alter table participants
  add column if not exists checked_in_at timestamptz;

comment on column participants.checked_in_at is
  '리셉션에서 출석 확인한 시각. null 이면 아직 도착하지 않음.';

-- 배정된 사람만 출석할 수 있다. 대기자·취소자는 앉을 자리가 없다.
alter table participants
  drop constraint if exists only_assigned_can_check_in;

alter table participants
  add constraint only_assigned_can_check_in
  check (checked_in_at is null or status = 'assigned');

-- 회차별 출석/미도착 집계와 리셉션 화면 필터에 쓰인다.
create index if not exists participants_attendance_idx
  on participants (assigned_round_id, checked_in_at)
  where status = 'assigned';
