import { Alert, Button, Form, Input, Result, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        'Something went wrong';
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
          title="Check your email"
          subTitle={
            <>
              If an account exists for <strong>{sentEmail}</strong>, we've sent a password reset
              link. It expires in 15 minutes.
            </>
          }
          extra={<Link to="/login">Back to sign in</Link>}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
        Forgot password?
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 32 }}>
        Enter your email and we'll send you a reset link.
      </Typography.Paragraph>

      <Form layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Email"
          name="email"
          rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
        >
          <Input autoFocus />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Send reset link
          </Button>
        </Form.Item>
      </Form>

      <Typography.Paragraph style={{ textAlign: 'center' }}>
        <Link to="/login">Back to sign in</Link>
      </Typography.Paragraph>
    </div>
  );
}
