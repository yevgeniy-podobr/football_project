import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values: { password: string }) => {
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword(token, values.password);
      navigate('/login', { state: { notice: 'Password updated — please sign in.' } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Reset failed';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: '64px auto 0', textAlign: 'center' }}>
        <Alert message="Invalid reset link — no token found." type="error" showIcon />
        <Typography.Paragraph style={{ marginTop: 16 }}>
          <Link to="/forgot-password">Request a new link</Link>
        </Typography.Paragraph>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        Set new password
      </Typography.Title>

      <Form layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="New password"
          name="password"
          rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}
        >
          <Input.Password autoFocus />
        </Form.Item>

        <Form.Item
          label="Confirm password"
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Update password
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
