import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useUserStore } from '../store/userStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useUserStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleFinish = async (values: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    setError('');
    setLoading(true);
    try {
      const { user, access_token } = await authApi.register(values);
      setUser(user, access_token);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('auth.registrationFailed');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        {t('auth.registerTitle')}
      </Typography.Title>

      <Form layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item
          label={t('auth.username')}
          name="username"
          rules={[{ required: true, min: 3, message: t('auth.usernameMin') }]}
        >
          <Input autoFocus />
        </Form.Item>

        <Form.Item label={t('auth.firstName')} name="firstName">
          <Input />
        </Form.Item>

        <Form.Item label={t('auth.lastName')} name="lastName">
          <Input />
        </Form.Item>

        <Form.Item
          label={t('auth.email')}
          name="email"
          rules={[{ required: true, type: 'email', message: t('auth.emailInvalid') }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label={t('auth.password')}
          name="password"
          rules={[{ required: true, min: 6, message: t('auth.passwordMin') }]}
        >
          <Input.Password />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('auth.createAccount')}
          </Button>
        </Form.Item>
      </Form>

      <Typography.Paragraph style={{ textAlign: 'center' }}>
        {t('auth.haveAccount')} <Link to="/login">{t('auth.signIn')}</Link>
      </Typography.Paragraph>
    </div>
  );
}
