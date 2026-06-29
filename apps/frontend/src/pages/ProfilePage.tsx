import { Alert, Button, Card, Form, Input, Modal, message, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/client';
import { useUserStore } from '../store/userStore';

const { Title, Text } = Typography;

const normalize = (v: string | null | undefined) => v?.trim() ?? '';

type ApiError = { response?: { data?: { message?: string | string[] } } };

function extractApiError(err: unknown, fallback: string): string {
  const msg = (err as ApiError)?.response?.data?.message ?? fallback;
  return Array.isArray(msg) ? msg.join(', ') : msg;
}

export default function ProfilePage() {
  const user = useUserStore((s) => s.user);
  const updateUser = useUserStore((s) => s.updateUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form] = Form.useForm<{ firstName: string; lastName: string }>();

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwForm] = Form.useForm<{
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }>();

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
      setError(extractApiError(err, t('profile.saveFailed')));
    } finally {
      setLoading(false);
    }
  };

  const openPwModal = () => {
    pwForm.resetFields();
    setPwError('');
    setPwModalOpen(true);
  };

  const closePwModal = () => {
    pwForm.resetFields();
    setPwError('');
    setPwModalOpen(false);
  };

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setPwError('');
    setPwLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success(t('profile.changePasswordSuccess'));
      setPwModalOpen(false);
      pwForm.resetFields();
    } catch (err: unknown) {
      setPwError(extractApiError(err, t('profile.changePasswordFailed')));
    } finally {
      setPwLoading(false);
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

      <Button type="link" style={{ padding: 0 }} onClick={openPwModal}>
        {t('profile.changePasswordTitle')}
      </Button>

      <Modal
        title={t('profile.changePasswordTitle')}
        open={pwModalOpen}
        onCancel={closePwModal}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={pwForm}
          layout="vertical"
          onFinish={handleChangePassword}
          autoComplete="off"
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label={t('profile.currentPassword')}
            name="currentPassword"
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label={t('profile.newPassword')}
            name="newPassword"
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              { min: 6, message: t('auth.passwordMin') },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label={t('profile.confirmNewPassword')}
            name="confirmNewPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('profile.confirmNewPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('profile.newPasswordsNoMatch')));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          {pwError && <Alert title={pwError} type="error" showIcon style={{ marginBottom: 16 }} />}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={pwLoading} disabled={pwLoading}>
              {t('profile.changePasswordBtn')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
