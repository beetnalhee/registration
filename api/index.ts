/**
 * Vercel Serverless Function 진입점.
 *
 * vercel.json 의 rewrite 로 /api/* 요청이 모두 이 함수로 들어오고,
 * Express 앱이 경로별로 분기한다.
 * 앱 인스턴스는 모듈 스코프에 두어 워밍된 인스턴스에서 재사용된다.
 */
import { createApp } from '../server/app';

export default createApp();
