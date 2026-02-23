import React, { useState } from 'react'
import { Form, Input, Button, Alert, Spin } from 'antd'
import { UserOutlined, LockOutlined, BankOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const onFinish = async ({ username, password }: { username: string; password: string }) => {
        setError('')
        setLoading(true)
        try {
            await login(username, password)
            navigate('/')
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Неверный логин или пароль')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base)',
            padding: 24,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                width: 600,
                height: 600,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
            }} />

            <div style={{
                width: '100%',
                maxWidth: 400,
                position: 'relative',
                zIndex: 1,
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 18,
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 8px 32px rgba(201,168,76,0.3)',
                    }}>
                        <BankOutlined style={{ fontSize: 30, color: '#1a1000' }} />
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
                        Номерной Фонд
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>
                        Войдите в систему управления
                    </div>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 32,
                    boxShadow: 'var(--shadow)',
                }}>
                    {error && (
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                            style={{ marginBottom: 20, background: 'rgba(232,84,84,0.1)', border: '1px solid rgba(232,84,84,0.3)', borderRadius: 8 }}
                        />
                    )}

                    <Form layout="vertical" onFinish={onFinish} size="large">
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: 'Введите логин' }]}
                        >
                            <Input
                                prefix={<UserOutlined style={{ color: 'var(--text-muted)' }} />}
                                placeholder="Логин"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Введите пароль' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                                placeholder="Пароль"
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={{ height: 44, fontSize: 15, fontWeight: 600, borderRadius: 10 }}
                            >
                                Войти
                            </Button>
                        </Form.Item>
                    </Form>
                </div>

                <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                    Hotel Management System v1.0
                </div>
            </div>
        </div>
    )
}
