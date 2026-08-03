import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { PageShell, SectionTitle } from '../../components/ui/PageShell';
import { toErrorMessage } from '../../hooks/useAsync';
import { login } from '../../lib/adminApi';
import { saveAdminSession } from '../../lib/adminSession';

export const AdminLoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      saveAdminSession(await login({ email: email.trim().toLowerCase(), password }));
      navigate('/admin', { replace: true });
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell bare>
      <div className="pt-16">
        <SectionTitle plain eyebrow="Admin Page" title="관리자 로그인" />

        {error && <ErrorBanner message={error} />}

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <TextField
            label="이메일"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" fullWidth loading={loading}>
            로그인
          </Button>
        </form>
      </div>
    </PageShell>
  );
};
