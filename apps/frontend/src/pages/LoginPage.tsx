import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useUser } from '../context/UserContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const notice = (location.state as { notice?: string } | null)?.notice;

  const handleFinish = async (values: { email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      const { user, access_token } = await authApi.login(values);
      login(user, access_token);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '64px auto 0' }}>
      <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        Sign in
      </Typography.Title>

      {notice && <Alert message={notice} type="success" showIcon style={{ marginBottom: 16 }} />}

      <Form layout="vertical" onFinish={handleFinish} autoComplete="off">
        <Form.Item
          label="Email"
          name="email"
          rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
        >
          <Input autoFocus />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password />
        </Form.Item>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Sign in
          </Button>
        </Form.Item>
      </Form>

      <Typography.Paragraph style={{ textAlign: 'center', marginTop: 4 }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </Typography.Paragraph>
      <Typography.Paragraph style={{ textAlign: 'center' }}>
        No account? <Link to="/register">Register</Link>
      </Typography.Paragraph>
    </div>
  );
}
