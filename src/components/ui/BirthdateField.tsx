import { useEffect, useState } from 'react';
import { FieldShell } from './Field';

/**
 * 생년월일 입력 — 연 / 월 / 일 드롭다운 3개.
 *
 * <input type="date"> 를 쓰지 않는 이유:
 *  · 모바일에서 달력 위젯이 열려 1990년대까지 거슬러 올라가기가 번거롭다
 *  · iOS Safari 는 날짜 입력의 고유 너비를 강제해서 w-full 을 무시한다
 *    (실제로 조회 화면에서 생년월일 칸만 옆 칸보다 길어지는 문제가 있었다)
 *  · 'YYYY. MM. DD.' 같은 자리표시자가 무엇을 넣어야 하는지 알려주지 못한다
 *
 * 드롭다운은 위 세 문제가 모두 없고 어느 기기에서든 같은 크기로 렌더된다.
 */

const DEFAULT_YEAR = 2000;
/** 참가 가능 연령(만 18~35세)보다 넉넉하게 열어둔다.
 *  범위를 벗어난 나이는 서버가 안내 문구와 함께 거절하는 편이 낫다. */
const MIN_YEAR = 1980;
const MAX_YEAR = 2010;

const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) => MAX_YEAR - index);
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** 해당 연·월의 마지막 날. 윤년도 자동으로 맞는다. */
const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

const pad = (value: number): string => String(value).padStart(2, '0');

interface Parts {
  year: number;
  month: number | null;
  day: number | null;
}

const parse = (value: string): Parts => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!matched) {
    return { year: DEFAULT_YEAR, month: null, day: null };
  }

  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
};

interface BirthdateFieldProps {
  label: string;
  /** 'YYYY-MM-DD' 또는 빈 문자열 */
  value: string;
  /** 세 항목이 모두 채워지면 'YYYY-MM-DD', 아니면 빈 문자열을 넘긴다 */
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

// appearance 를 없애지 않는다. 기기 기본 화살표가 있어야 드롭다운임을 알 수 있고,
// 좁은 화면에서 세 개가 나란히 들어가도록 좌우 여백만 줄인다.
const SELECT_CLASS = 'input-base min-w-0 flex-1 px-3 text-[15px]';

export const BirthdateField = ({
  label,
  value,
  onChange,
  error,
  hint,
}: BirthdateFieldProps) => {
  const [parts, setParts] = useState<Parts>(() => parse(value));

  // 폼이 초기화되면(예: 조회 후 다시 조회하기) 내부 상태도 되돌린다.
  useEffect(() => {
    if (value === '') {
      setParts((previous) =>
        previous.month === null && previous.day === null ? previous : parse(''),
      );
    }
  }, [value]);

  const emit = (next: Parts) => {
    setParts(next);

    if (next.month === null || next.day === null) {
      onChange('');
      return;
    }

    // 2월 31일처럼 존재하지 않는 조합은 그 달의 마지막 날로 당긴다.
    const lastDay = daysInMonth(next.year, next.month);
    const day = Math.min(next.day, lastDay);

    if (day !== next.day) {
      setParts({ ...next, day });
    }

    onChange(`${next.year}-${pad(next.month)}-${pad(day)}`);
  };

  const dayCount = parts.month === null ? 31 : daysInMonth(parts.year, parts.month);
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  return (
    <FieldShell label={label} {...(error ? { error } : {})} {...(hint ? { hint } : {})}>
      <div className="flex gap-2">
        <select
          aria-label={`${label} 연도`}
          value={parts.year}
          onChange={(event) => emit({ ...parts, year: Number(event.target.value) })}
          className={SELECT_CLASS}
        >
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {year}년
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} 월`}
          value={parts.month ?? ''}
          onChange={(event) =>
            emit({ ...parts, month: event.target.value === '' ? null : Number(event.target.value) })
          }
          className={SELECT_CLASS}
        >
          <option value="">월</option>
          {MONTHS.map((month) => (
            <option key={month} value={month}>
              {month}월
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} 일`}
          value={parts.day ?? ''}
          onChange={(event) =>
            emit({ ...parts, day: event.target.value === '' ? null : Number(event.target.value) })
          }
          className={SELECT_CLASS}
        >
          <option value="">일</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}일
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
};
