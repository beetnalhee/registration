-- ============================================================================
-- 초기 데이터
--
-- ⚠️ event_date 는 반드시 실제 행사 당일로 바꿔주세요.
--    만나이 계산 기준일이므로 이 값이 틀리면 그룹 배정이 어긋납니다.
--    (관리자 페이지에서도 변경할 수 있습니다)
-- ============================================================================

insert into event_settings (id, event_name, event_date, is_open, near_full_threshold,
                            min_age, max_age, bridge_min_age, bridge_max_age)
values (true, '한여름 밤의 꿈', date '2026-08-15', true, 0.800, 18, 35, 24, 27)
on conflict (id) do nothing;

-- 그룹: 연령대를 추측할 수 없는 중립적 이름 (참가번호에 그대로 노출된다)
insert into groups (code, display_name, min_age, max_age, sort_order) values
  ('SUMMER', 'SUMMER', 18, 25, 1),
  ('NIGHT',  'NIGHT',  26, 35, 2)
on conflict (code) do nothing;

-- 회차
insert into rounds (round_no, starts_at, ends_at) values
  (1, time '09:40', time '10:00'),
  (2, time '10:05', time '10:25'),
  (3, time '10:30', time '10:50')
on conflict (round_no) do nothing;

-- 하드 정원: 회차별 남 20 / 여 20  → 총 120명
insert into round_capacity (round_id, gender, capacity)
select r.id, g.gender, 20
from rounds r
cross join (values ('M'::gender_code), ('F'::gender_code)) as g (gender)
on conflict (round_id, gender) do nothing;

-- 그룹 카운터: 회차 × 그룹 × 성별 조합을 미리 만들어 두면
-- 배정 트랜잭션이 INSERT 없이 UPDATE 만으로 끝나 경합 지점이 하나로 줄어든다.
insert into group_tally (round_id, group_code, gender)
select r.id, gr.code, g.gender
from rounds r
cross join groups gr
cross join (values ('M'::gender_code), ('F'::gender_code)) as g (gender)
on conflict (round_id, group_code, gender) do nothing;

-- ── 관리자 등록 방법 ────────────────────────────────────────────────────────
-- 1) Supabase 대시보드 > Authentication > Users > Add user 로 계정을 만든다
--    (Auto Confirm User 체크)
-- 2) 생성된 User UID 를 복사해 아래 쿼리를 실행한다
--
-- insert into admins (user_id, email, display_name)
-- values ('붙여넣은-uuid', 'admin@example.com', '운영자');
