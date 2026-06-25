import { UserOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Dropdown,
  Grid,
  Layout,
  Menu,
  type MenuProps,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

const { Header } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export default function Navbar() {
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screens = useBreakpoint();
  const isMobile = screens.md === false;

  const navItems = [
    { key: '/', label: 'Matches' },
    { key: '/predictions', label: 'Predictions' },
    ...(user?.role === 'ADMIN' ? [{ key: '/admin', label: 'Admin' }] : []),
  ];

  const selectedKey = (() => {
    if (pathname === '/') return '/';
    for (const item of navItems) {
      if (item.key !== '/' && pathname.startsWith(item.key)) return item.key;
    }
    return '';
  })();

  const userDisplayName = user
    ? user.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
      : (user.username ?? user.email)
    : '';

  const avatarLabel = user
    ? (user.firstName?.[0] ?? user.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
    : undefined;

  const dropdownItems: MenuProps['items'] = user
    ? [
        {
          key: 'info',
          label: (
            <div>
              <div style={{ fontSize: 13 }}>{userDisplayName}</div>
              {user.role === 'ADMIN' && (
                <Tag color="orange" style={{ margin: '4px 0 0', display: 'inline-block' }}>
                  Admin
                </Tag>
              )}
            </div>
          ),
          disabled: true,
        },
        { type: 'divider' },
        { key: 'profile', label: 'Profile', onClick: () => navigate('/profile') },
        { key: 'signout', label: 'Sign out', onClick: logout },
      ]
    : [
        { key: 'register', label: 'Register', onClick: () => navigate('/register') },
        { key: 'login', label: 'Sign in', onClick: () => navigate('/login') },
      ];

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Text
        strong
        style={{
          color: '#60a5fa',
          fontSize: isMobile ? 14 : 18,
          whiteSpace: 'nowrap',
          marginRight: isMobile ? 8 : 24,
          flexShrink: 0,
        }}
      >
        {isMobile ? 'FP' : 'Football Predictor'}
      </Text>

      <Menu
        mode="horizontal"
        selectedKeys={[selectedKey]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, border: 'none', background: 'transparent', minWidth: 0 }}
      />

      {isMobile ? (
        <Dropdown menu={{ items: dropdownItems }} trigger={['click']} placement="bottomRight">
          <Avatar
            icon={!avatarLabel ? <UserOutlined /> : undefined}
            style={{
              cursor: 'pointer',
              flexShrink: 0,
              backgroundColor: user ? '#60a5fa' : '#6b7280',
            }}
          >
            {avatarLabel}
          </Avatar>
        </Dropdown>
      ) : (
        <Space style={{ flexShrink: 0 }}>
          {user ? (
            <>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {userDisplayName}
              </Text>
              {user.role === 'ADMIN' && (
                <Tag color="orange" style={{ margin: 0 }}>
                  Admin
                </Tag>
              )}
              <Button size="small" onClick={() => navigate('/profile')}>
                Profile
              </Button>
              <Button size="small" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button
                size="small"
                type={pathname === '/register' ? 'primary' : 'default'}
                onClick={() => navigate('/register')}
              >
                Register
              </Button>
              <Button
                size="small"
                type={pathname === '/login' ? 'primary' : 'default'}
                onClick={() => navigate('/login')}
              >
                Sign in
              </Button>
            </>
          )}
        </Space>
      )}
    </Header>
  );
}
