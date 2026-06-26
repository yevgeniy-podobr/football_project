import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleFinish = async (values: { password: string }) => {
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(token, values.password);
      navigate('/login', { state: { notice: t('auth.passwordUpdated') } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('auth.resetFailed');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: '64px auto 0', textAlign: 'center' }}>
        <Alert title={t('auth.invalidResetLink')} type="error" showIcon />
        <Typography.Paragraph style={{ marginTop: 16 }}>
          <Link to="/forgot-password">{t('auth.requestNewLink')}</Link>
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        {t('auth.resetTitle')}
      </Typography.Title>

      <Form layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label={t('auth.newPassword')}
          name="password"
          rules={[{ required: true, min: 6, message: t('auth.passwordMin') }]}
        >
          <Input.Password autoFocus />
        </Form.Item>

        <Form.Item
          label={t('auth.confirmPassword')}
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: t('auth.confirmPasswordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error(t('auth.passwordsNoMatch')));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('auth.updatePassword')}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
