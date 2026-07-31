import { Navigate, Outlet } from 'react-router-dom';
import { readAdminSession } from '../../lib/adminSession';

/**
 * 관리자 라우트 가드.
 *
 * 이것은 편의 장치일 뿐이고 실제 권한 검사는 서버가 한다.
 * 토큰 없이 /admin 을 열어도 API 가 401 을 돌려주므로 데이터는 노출되지 않는다.
 */
export const RequireAdminSession = () =>
  readAdminSession() ? <Outlet /> : <Navigate to="/admin/login" replace />;
