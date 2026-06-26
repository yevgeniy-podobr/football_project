import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useUserStore } from '../store/userStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const notice = (location.state as { notice?: string } | null)?.notice;

  const handleFinish = async (values: { email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      const { user, access_token } = await authApi.login(values);
      setUser(user, access_token);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('auth.loginFailed');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        {t('auth.loginTitle')}
      </Typography.Title>

      {notice && <Alert title={notice} type="success" showIcon style={{ marginBottom: 16 }} />}

      <Form layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item
          label={t('auth.email')}
          name="email"
          rules={[{ required: true, type: 'email', message: t('auth.emailInvalid') }]}
        >
          <Input autoFocus />
        </Form.Item>

        <Form.Item
          label={t('auth.password')}
          name="password"
          rules={[{ required: true, message: t('auth.passwordRequired') }]}
        >
          <Input.Password />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('auth.signIn')}
          </Button>
        </Form.Item>
      </Form>

      <Typography.Paragraph style={{ textAlign: 'center', marginTop: 4 }}>
        <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
      </Typography.Paragraph>
      <Typography.Paragraph style={{ textAlign: 'center' }}>
        {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
      </Typography.Paragraph>
    </div>
  );
}
