import { UserOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Dropdown,
  Grid,
  Layout,
  Menu,
  type MenuProps,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();

  const currentLang = i18n.language.startsWith('uk') ? 'UA' : 'EN';
  const handleLangChange = (val: string) => i18n.changeLanguage(val === 'UA' ? 'uk' : 'en');

  const navItems = [
    { key: '/', label: t('navbar.matches') },
    { key: '/predictions', label: t('navbar.predictions') },
    ...(user?.role === 'ADMIN' ? [{ key: '/admin', label: t('navbar.admin') }] : []),
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

  const langMenuItems: MenuProps['items'] = [
    { type: 'divider' },
    {
      key: 'lang-en',
      label: `${currentLang === 'EN' ? '✓ ' : ''}EN — English`,
      onClick: () => handleLangChange('EN'),
    },
    {
      key: 'lang-uk',
      label: `${currentLang === 'UA' ? '✓ ' : ''}UA — Українська`,
      onClick: () => handleLangChange('UA'),
    },
  ];

  const dropdownItems: MenuProps['items'] = user
    ? [
        {
          key: 'info',
          label: (
            <div>
              <div style={{ fontSize: 13 }}>{userDisplayName}</div>
              {user.role === 'ADMIN' && (
                <Tag color="orange" style={{ margin: '4px 0 0', display: 'inline-block' }}>
                  {t('navbar.adminBadge')}
                </Tag>
              )}
            </div>
          ),
          disabled: true,
        },
        { type: 'divider' },
        { key: 'profile', label: t('navbar.profile'), onClick: () => navigate('/profile') },
        { key: 'signout', label: t('navbar.signOut'), onClick: logout },
        ...langMenuItems,
      ]
    : [
        { key: 'register', label: t('navbar.register'), onClick: () => navigate('/register') },
        { key: 'login', label: t('navbar.signIn'), onClick: () => navigate('/login') },
        ...langMenuItems,
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
        {isMobile ? t('navbar.brandMobile') : t('navbar.brand')}
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
          <Segmented
            size="small"
            options={['EN', 'UA']}
            value={currentLang}
            onChange={(val) => handleLangChange(val as string)}
          />
          {user ? (
            <>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {userDisplayName}
              </Text>
              {user.role === 'ADMIN' && (
                <Tag color="orange" style={{ margin: 0 }}>
                  {t('navbar.adminBadge')}
                </Tag>
              )}
              <Button size="small" onClick={() => navigate('/profile')}>
                {t('navbar.profile')}
              </Button>
              <Button size="small" onClick={logout}>
                {t('navbar.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="small"
                type={pathname === '/register' ? 'primary' : 'default'}
                onClick={() => navigate('/register')}
              >
                {t('navbar.register')}
              </Button>
              <Button
                size="small"
                type={pathname === '/login' ? 'primary' : 'default'}
                onClick={() => navigate('/login')}
              >
                {t('navbar.signIn')}
              </Button>
            </>
          )}
        </Space>
      )}
    </Header>
  );
}
