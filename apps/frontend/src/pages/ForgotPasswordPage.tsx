import { Alert, Button, Form, Input, Result, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleFinish = async (values: { email: string }) => {
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(values.email);
      setSentEmail(values.email);
      setSent(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('auth.somethingWentWrong');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
        <Result
          icon={<span style={{ fontSize: 48 }}>📧</span>}
          title={t('auth.checkEmailTitle')}
          subTitle={t('auth.checkEmailBody', { email: sentEmail })}
          extra={<Link to="/login">{t('auth.backToSignIn')}</Link>}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
        {t('auth.forgotPassword')}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 32 }}>
        {t('auth.forgotSubtitle')}
      </Typography.Paragraph>

      <Form layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label={t('auth.email')}
          name="email"
          rules={[{ required: true, type: 'email', message: t('auth.emailInvalid') }]}
        >
          <Input autoFocus />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            {t('auth.sendResetLink')}
          </Button>
        </Form.Item>
      </Form>

      <Typography.Paragraph style={{ textAlign: 'center' }}>
        <Link to="/login">{t('auth.backToSignIn')}</Link>
      </Typography.Paragraph>
    </div>
  );
}
