import { Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const { Header } = Layout;
const { Text } = Typography;

export default function Navbar() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Text
        strong
        style={{ color: '#60a5fa', fontSize: 18, whiteSpace: 'nowrap', marginRight: 24 }}
      >
        Football Predictor
      </Text>

      <Menu
        mode="horizontal"
        selectedKeys={[selectedKey]}
        items={navItems}
        onClick={({ key }) => navigate(key)}
        style={{ flex: 1, border: 'none', background: 'transparent', minWidth: 0 }}
      />

      <Space style={{ flexShrink: 0 }}>
        {user ? (
          <>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {user.firstName
                ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
                : (user.username ?? user.email)}
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
    </Header>
  );
}
