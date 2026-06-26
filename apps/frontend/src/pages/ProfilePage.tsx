import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/client';
import { useUserStore } from '../store/userStore';

const { Title, Text } = Typography;

const normalize = (v: string | null | undefined) => v?.trim() ?? '';

export default function ProfilePage() {
  const user = useUserStore((s) => s.user);
  const updateUser = useUserStore((s) => s.updateUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm<{ firstName: string; lastName: string }>();
  const { t } = useTranslation();

  const firstName = Form.useWatch('firstName', form);
  const lastName = Form.useWatch('lastName', form);

  const hasChanged =
    normalize(firstName) !== normalize(user?.firstName) ||
    normalize(lastName) !== normalize(user?.lastName);

  const handleFinish = async (values: { firstName?: string; lastName?: string }) => {
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const { user: updated, access_token } = await authApi.updateProfile({
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName?.trim() || null,
      });
      updateUser(updated, access_token);
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('profile.saveFailed');
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        {t('profile.title')}
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('profile.username')}
            </Text>
            <div>
              <Text strong>{user?.username ?? '—'}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('profile.email')}
            </Text>
            <div>
              <Text strong>{user?.email}</Text>
            </div>
          </div>
        </div>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
        }}
      >
        <Form.Item label={t('profile.firstName')} name="firstName">
          <Input placeholder={t('profile.firstName')} />
        </Form.Item>

        <Form.Item label={t('profile.lastName')} name="lastName">
          <Input placeholder={t('profile.lastName')} />
        </Form.Item>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        {success && (
          <Alert
            title={t('profile.savedSuccess')}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={!hasChanged || loading}
          >
            {t('profile.save')}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
