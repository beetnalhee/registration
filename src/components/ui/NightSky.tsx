import { useMemo } from 'react';

interface Star {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

/** 결정적 난수 — 새로 고침해도 별 위치가 흔들리지 않는다. */
const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

const buildStars = (count: number): Star[] => {
  const random = createRandom(20_260_815);

  return Array.from({ length: count }, () => ({
    left: random() * 100,
    top: random() * 100,
    size: 1 + random() * 2.2,
    delay: random() * 4,
    duration: 2.6 + random() * 3,
    opacity: 0.35 + random() * 0.55,
  }));
};

/**
 * 배경 밤하늘. 자바스크립트 애니메이션 라이브러리 없이
 * CSS 키프레임만으로 별이 반짝이게 한다.
 * 화면 조작을 막지 않도록 pointer-events 를 끈다.
 */
export const NightSky = () => {
  const stars = useMemo(() => buildStars(64), []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 달빛 */}
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-moonlight/20 blur-3xl" />
      <div className="absolute right-8 top-10 h-20 w-20 animate-float rounded-full bg-moonlight-soft/90 shadow-glow" />

      {/* 지평선 쪽 은은한 온기 */}
      <div className="absolute -bottom-24 left-1/2 h-72 w-[130%] -translate-x-1/2 rounded-[50%] bg-peach/10 blur-3xl" />

      {stars.map((star, index) => (
        <span
          key={index}
          className="absolute animate-twinkle rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
};
