import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, theme } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    HomeOutlined,
    TeamOutlined,
    UserOutlined,
    CalendarOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BankOutlined,
    SettingOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Sider, Content, Header } = Layout

const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: 'Номера' },
    { key: '/employees', icon: <TeamOutlined />, label: 'Сотрудники' },
    { key: '/guests', icon: <UserOutlined />, label: 'Гости' },
    { key: '/calendar', icon: <CalendarOutlined />, label: 'Календарь' },
]

const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    cleaner: 'Уборщик',
    repair: 'Ремонтник',
}

export default function MainLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const userMenu = {
        items: [
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Выйти',
                danger: true,
                onClick: () => { logout(); navigate('/login') },
            },
        ],
    }

    return (
        <Layout style={{ height: '100vh' }}>
            <Sider
                breakpoint="md"
                collapsedWidth="0"
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                trigger={null}
                width={220}
                style={{
                    background: 'var(--bg-sidebar)',
                    borderRight: '1px solid var(--border)',
                    overflow: 'hidden',
                }}
            >
                {/* Logo */}
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: collapsed ? '0 24px' : '0 20px',
                    borderBottom: '1px solid var(--border)',
                    transition: 'all 0.2s',
                }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <BankOutlined style={{ color: '#1a1000', fontSize: 18 }} />
                    </div>
                    {!collapsed && (
                        <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Номерной</div>
                            <div style={{ color: 'var(--primary)', fontWeight: 500, fontSize: 11, letterSpacing: 1 }}>ФОНД</div>
                        </div>
                    )}
                </div>

                <Menu
                    mode="inline"
                    theme="dark"
                    selectedKeys={[location.pathname]}
                    onClick={({ key }) => navigate(key)}
                    items={[
                        ...menuItems,
                        ...(user?.role === 'admin' ? [{ key: '/settings', icon: <SettingOutlined />, label: 'Настройки' }] : []),
                    ]}
                    style={{
                        marginTop: 8,
                        border: 'none',
                    }}
                />
            </Sider>

            <Layout>
                <Header style={{
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border)',
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 64,
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ color: 'var(--text-secondary)', fontSize: 16 }}
                    />

                    <Dropdown menu={userMenu} placement="bottomRight" arrow>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            padding: '4px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            transition: 'border-color 0.2s',
                            maxWidth: 200,
                        }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                            <Avatar
                                size={32}
                                style={{ background: 'var(--primary)', color: '#1a1000', fontWeight: 700, fontSize: 13, flexShrink: 0 }}
                            >
                                {user?.full_name?.[0] || 'U'}
                            </Avatar>
                            <div className="hide-on-mobile" style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 'normal' }}>
                                <div style={{
                                    color: 'var(--text-primary)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    width: '100%',
                                }}>
                                    {user?.full_name || 'Пользователь'}
                                </div>
                                <div style={{
                                    color: 'var(--primary)',
                                    fontSize: 11,
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    width: '100%',
                                }}>
                                    {roleLabels[user?.role || ''] || user?.role}
                                </div>
                            </div>
                        </div>
                    </Dropdown>
                </Header>

                <Content style={{ padding: '16px 24px', overflow: 'auto', background: 'var(--bg-base)' }}>
                    <div className="fade-in">
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}
