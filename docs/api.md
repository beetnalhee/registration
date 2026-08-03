# API 명세

기본 경로: `/api`

## 공통 응답 봉투

성공

```json
{ "success": true, "data": { }, "error": null }
```

실패

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DUPLICATE_EMAIL",
    "message": "이미 이 이메일로 신청이 접수되어 있어요. 조회 페이지에서 확인해 주세요.",
    "fields": { "email": "..." }
  }
}
```

`message` 는 그대로 사용자에게 보여줄 수 있는 문구입니다.
내부 규칙·정원 수치·스택은 포함되지 않습니다.

### 오류 코드

| code | status | 의미 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 입력값 검증 실패 (`fields` 에 필드별 메시지) |
| `BAD_REQUEST` | 400 | 연령 미달/초과 등 |
| `UNAUTHORIZED` | 401 | 토큰 없음·만료 |
| `FORBIDDEN` | 403 | 관리자로 등록되지 않은 계정 |
| `NOT_FOUND` | 404 | 조회 결과 없음 |
| `DUPLICATE_EMAIL` / `DUPLICATE_PHONE` | 409 | 중복 신청 |
| `EVENT_CLOSED` | 409 | 접수 중단 상태 |
| `ROUND_FULL` | 409 | 처리 중 해당 회차 마감 |
| `NO_SEAT_AVAILABLE` | 409 | 승격할 빈자리 없음 |
| `ALREADY_CANCELLED` | 409 | 이미 취소됨 |
| `TOO_MANY_REQUESTS` | 429 | 요청 제한 초과 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

---

# 참가자 API (인증 불필요)

## `GET /api/event`

행사 기본 정보와 회차 시간.

```json
{
  "eventName": "사랑은 돌아오는 거야",
  "eventDate": "2026-08-15",
  "isOpen": true,
  "rounds": [
    { "roundNo": 1, "startsAt": "09:40", "endsAt": "10:00", "timeLabel": "09:40 ~ 10:00" },
    { "roundNo": 2, "startsAt": "10:05", "endsAt": "10:25", "timeLabel": "10:05 ~ 10:25" },
    { "roundNo": 3, "startsAt": "10:30", "endsAt": "10:50", "timeLabel": "10:30 ~ 10:50" }
  ]
}
```

## `GET /api/rounds/availability`

회차 상태. **인원수·잔여석은 포함되지 않습니다.**

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `gender` | 아니오 | `M` \| `F`. 있으면 해당 성별 정원 기준. 없으면 남녀를 합쳐서 계산 |

```json
[
  { "roundNo": 1, "availability": "open" },
  { "roundNo": 2, "availability": "near_full" },
  { "roundNo": 3, "availability": "closed" }
]
```

## `POST /api/applications`

신청 접수 + 자동 배정. 요청 제한: **분당 5회 / IP**

```json
{
  "name": "김희주",
  "nickname": "희주",
  "birthdate": "2001-05-14",
  "gender": "F",
  "phone": "010-1234-8241",
  "email": "heeju@example.com",
  "preferences": [2, 1, 3]
}
```

| 필드 | 규칙 |
|---|---|
| `name` | 1~40자 (공백 제거) |
| `nickname` | 1~20자 |
| `birthdate` | `YYYY-MM-DD`, 실존하는 날짜 |
| `gender` | `M` \| `F` |
| `phone` | 한국 휴대폰. 하이픈·공백 허용 (서버에서 숫자만 남김) |
| `email` | 이메일 형식, 254자 이내 (소문자로 정규화) |
| `preferences` | 회차 번호 3개, 중복 불가, 1순위부터 순서대로 |

**201 배정됨**

```json
{
  "status": "assigned",
  "nickname": "희주",
  "groupCode": "SUMMER",
  "roundNo": 2,
  "timeLabel": "10:05 ~ 10:25",
  "participantCode": "SUMMER-2-F-013",
  "waitlistPosition": null
}
```

**201 대기자**

```json
{
  "status": "waitlisted",
  "nickname": "희주",
  "groupCode": null,
  "roundNo": null,
  "timeLabel": null,
  "participantCode": null,
  "waitlistPosition": 3
}
```

응답과 동시에 안내 이메일이 발송됩니다.
이메일 발송이 실패해도 신청은 성공으로 처리되고 `email_logs` 에 기록됩니다.

## `POST /api/lookup`

본인 조회. 요청 제한: **분당 10회 / IP**

```json
{ "birthdate": "2001-05-14", "phoneLast4": "8241" }
```

```json
{
  "status": "assigned",
  "maskedName": "김○○",
  "nickname": "희주",
  "groupCode": "SUMMER",
  "roundNo": 2,
  "timeLabel": "10:05 ~ 10:25",
  "participantCode": "SUMMER-2-F-013",
  "waitlistPosition": null
}
```

찾지 못하면 `404 NOT_FOUND`. 생년월일이 맞는지 / 번호가 맞는지 구분해 알려주지 않습니다.

---

# 관리자 API

로그인을 제외한 모든 요청에 `Authorization: Bearer <accessToken>` 이 필요합니다.

## `POST /api/admin/login`

요청 제한: **분당 10회 / IP**

```json
{ "email": "admin@example.com", "password": "········" }
```

```json
{
  "email": "admin@example.com",
  "displayName": "운영자",
  "accessToken": "eyJhbGciOi...",
  "expiresAt": 1786000000
}
```

계정이 있어도 `admins` 표에 없으면 `403 FORBIDDEN`.
비밀번호가 틀린 경우와 계정이 없는 경우를 구분해 알려주지 않습니다.

## `GET /api/admin/me`

```json
{ "email": "admin@example.com", "displayName": "운영자" }
```

## `GET /api/admin/overview`

실시간 현황. 참가자 API 와 달리 **실제 인원수와 성비를 포함합니다.**

```json
{
  "eventName": "사랑은 돌아오는 거야",
  "eventDate": "2026-08-15",
  "isOpen": true,
  "nearFullThreshold": 0.8,
  "totalAssigned": 74,
  "totalWaitlisted": 3,
  "totalCancelled": 2,
  "rounds": [
    {
      "roundNo": 1,
      "timeLabel": "09:40 ~ 10:00",
      "male":   { "filled": 18, "capacity": 20 },
      "female": { "filled": 17, "capacity": 20 },
      "availability": "near_full",
      "groups": [
        { "groupCode": "SUMMER", "male": 10, "female": 9 },
        { "groupCode": "NIGHT",  "male": 8,  "female": 8 }
      ]
    }
  ]
}
```

## `GET /api/admin/participants`

| 쿼리 | 설명 |
|---|---|
| `q` | 이름·닉네임·이메일·연락처·참가번호 부분 검색 |
| `status` | `assigned` \| `waitlisted` \| `cancelled` |
| `roundNo` | 회차 번호 |
| `groupCode` | `SUMMER` \| `NIGHT` |
| `gender` | `M` \| `F` |
| `page` | 기본 1 |
| `pageSize` | 기본 50, 최대 200 |

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "김희주",
      "nickname": "희주",
      "birthdate": "2001-05-14",
      "age": 25,
      "gender": "F",
      "phone": "01012348241",
      "email": "heeju@example.com",
      "preferences": [2, 1, 3],
      "status": "assigned",
      "groupCode": "SUMMER",
      "roundNo": 2,
      "timeLabel": "10:05 ~ 10:25",
      "participantCode": "SUMMER-2-F-013",
      "defaultGroupCode": "SUMMER",
      "isBridgeZone": true,
      "isGroupOverridden": false,
      "createdAt": "2026-08-01T09:12:33.000Z"
    }
  ],
  "total": 74,
  "page": 1,
  "pageSize": 50
}
```

`isBridgeZone` / `defaultGroupCode` / `isGroupOverridden` 은 **관리자 응답에만** 포함됩니다.

## `GET /api/admin/participants/:id`

```json
{
  "participant": { },
  "emailLogs": [
    {
      "id": "uuid",
      "kind": "assignment",
      "toAddress": "heeju@example.com",
      "status": "sent",
      "errorMessage": null,
      "createdAt": "2026-08-01T09:12:34.000Z"
    }
  ]
}
```

## `PATCH /api/admin/participants/:id/assignment`

회차/그룹 변경. 배정 상태인 참가자만 대상입니다.

```json
{ "roundNo": 3, "groupCode": "NIGHT", "reason": "본인 요청" }
```

`roundNo` 와 `groupCode` 는 각각 생략 가능하지만 **최소 하나는 있어야** 합니다.
참가번호가 새 기준으로 재발급됩니다.
목표 회차가 마감이면 `409 ROUND_FULL` — 관리자라도 정원 20명은 넘을 수 없습니다.

## `POST /api/admin/participants/:id/cancel`

```json
{ "notify": true }
```

좌석을 반납하고 `status='cancelled'` 로 변경합니다. `notify: false` 면 취소 안내 메일을 보내지 않습니다.

## `POST /api/admin/participants/:id/promote`

대기자 승격. 대기 상태인 참가자만 대상입니다.

```json
{ "roundNo": 2, "groupCode": "SUMMER" }
```

둘 다 생략하면 본인 희망 순위대로 빈자리를 찾고, 그룹은 신청 때와 같은 규칙으로 정합니다.
빈자리가 없으면 `409 NO_SEAT_AVAILABLE`. 승격 안내 메일이 자동 발송됩니다.

## `POST /api/admin/participants/:id/resend-email`

현재 상태(배정/대기/취소)에 맞는 안내 메일을 다시 보냅니다.

```json
{ "sent": true }
```

## `GET /api/admin/participants.csv`

참가자 전체를 CSV 로 내려받습니다. UTF-8 BOM 이 포함되어 엑셀에서 한글이 깨지지 않습니다.
수식 주입(`=`, `+`, `-`, `@` 로 시작하는 값)은 이스케이프됩니다.

> 개인정보가 포함된 파일입니다. 내려받은 뒤 보관에 주의하세요.

## `PATCH /api/admin/settings`

```json
{
  "eventName": "사랑은 돌아오는 거야",
  "eventDate": "2026-08-15",
  "isOpen": true,
  "nearFullThreshold": 0.8
}
```

모두 생략 가능하지만 최소 하나는 있어야 합니다. 변경 이력은 `audit_logs` 에 남습니다.

| 필드 | 효과 |
|---|---|
| `eventDate` | 만나이 계산 기준일. **접수 시작 전에 반드시 확인** |
| `isOpen` | `false` 면 모든 회차가 마감으로 표시되고 신청이 차단됨 |
| `nearFullThreshold` | `0 < x <= 1`. 마감 임박 표시 기준 |

---

## `GET /api/health`

DB 연결 확인용.

```json
{ "status": "ok" }
```
