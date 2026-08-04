-- ============================================================================
-- 004 · 조회 키 변경 + 희망 회차 단일 선택(선착순)
--
-- 1) 조회 키: (생년월일, 전화 뒤 4자리) → (이메일, 전화 뒤 4자리)
--    조회 화면에서 취소까지 할 수 있게 되면서 자격증명을 바꿨다.
--    생년월일은 지인이 알기 쉬운 정보라 취소 권한을 주기에 부적절하다.
--
-- 2) 희망 회차: 3순위 → 1개 선택
--    선착순으로 바꾼다. 고른 회차가 마감이면 다음 순위로 내려가지 않고
--    그 회차의 대기자가 된다. 본인 취소로 자리가 열렸을 때
--    "누가 그 자리를 기다리고 있는지"가 명확해진다.
-- ============================================================================

-- ── 1) 조회 키 ──────────────────────────────────────────────────────────────
-- (생년월일, 전화 뒤 4자리) 유일성은 더 이상 필요하지 않다.
-- 오히려 생일과 번호 뒷자리가 같은 두 사람의 신청을 막는 부작용만 남는다.
drop index if exists participants_lookup_key_uniq;

-- 이메일은 participants_active_email_uniq 로 이미 활성 신청 중 유일하므로
-- (이메일, 전화 뒤 4자리) 조합도 자동으로 한 명만 가리킨다.
-- 조회 시 전화 뒷자리 비교를 빠르게 하기 위한 인덱스만 둔다.
create index if not exists participants_phone_last4_idx
  on participants (phone_last4) where status <> 'cancelled';

-- ── 2) 희망 회차 단일화 ─────────────────────────────────────────────────────
alter table participants
  add column if not exists preferred_round_no int;

-- 기존 신청은 1순위를 선택 회차로 옮긴다.
update participants
   set preferred_round_no = pref_1
 where preferred_round_no is null;

alter table participants
  alter column preferred_round_no set not null;

alter table participants
  drop constraint if exists prefs_distinct;

alter table participants drop column if exists pref_1;
alter table participants drop column if exists pref_2;
alter table participants drop column if exists pref_3;

alter table participants
  drop constraint if exists preferred_round_is_positive;

alter table participants
  add constraint preferred_round_is_positive check (preferred_round_no > 0);

comment on column participants.preferred_round_no is
  '참가자가 고른 회차. 선착순이므로 대체 순위가 없다.';
