import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Spin, Row, Col, Typography, Divider } from 'antd'
import { SaveOutlined, SettingOutlined, CloudServerOutlined } from '@ant-design/icons'
import api from '../api/client'

const { Title, Text } = Typography

interface AppConfig {
    key: string
    value: string
}

export default function SettingsPage() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await api.get<AppConfig[]>('/settings')
            const initialValues: Record<string, string> = {}
            data.forEach(cfg => { initialValues[cfg.key] = cfg.value })
            form.setFieldsValue(initialValues)
        } catch (e) {
            message.error('Ошибка загрузки настроек')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const handleSave = async (values: any) => {
        try {
            await api.put('/settings', values)
            message.success('Настройки успешно сохранены')
            load()
        } catch (e) {
            message.error('Ошибка сохранения настроек')
        }
    }

    if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: 32 }}>
                <div>
                    <div className="page-title">Настройки системы</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                        Глобальные конфигурации для администраторов
                    </div>
                </div>
            </div>

            <Card style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <Form form={form} layout="vertical" onFinish={handleSave}>

                    {/* ── Telegram ─────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SettingOutlined style={{ fontSize: 20, color: '#1a1000' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>Telegram интеграция</Title>
                            <Text style={{ color: 'var(--text-muted)' }}>Настройка бота и общей группы для уведомлений</Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="tg_bot_token"
                                label="Bot Token (Токен бота)"
                                extra="Выдается в BotFather при создании"
                            >
                                <Input.Password placeholder="123456789:ABCDefgh..." />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="tg_group_chat_id"
                                label="Group Chat ID"
                                extra="ID группы, куда бот добавлен админом (напр. -100...)"
                            >
                                <Input placeholder="-1001234567890" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ── NextCloud Talk ───────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--info)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CloudServerOutlined style={{ fontSize: 20, color: '#fff' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>NextCloud Talk интеграция</Title>
                            <Text style={{ color: 'var(--text-muted)' }}>Настройка бота NextCloud Talk для уведомлений</Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="nc_url"
                                label="URL сервера NextCloud"
                                extra="Например: https://cloud.example.com"
                            >
                                <Input placeholder="https://cloud.example.com" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="nc_bot_user"
                                label="Логин бота (пользователь NC)"
                                extra="Имя пользователя в NextCloud"
                            >
                                <Input placeholder="hotel_bot" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="nc_bot_password"
                                label="Пароль бота"
                                extra="Пароль аккаунта или App Password"
                            >
                                <Input.Password placeholder="••••••••" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="nc_room_token"
                                label="Token общей комнаты"
                                extra="Токен комнаты для системных логов (из URL чата)"
                            >
                                <Input placeholder="abc123def456" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" style={{ borderRadius: 8 }}>
                            Сохранить настройки
                        </Button>
                    </div>

                </Form>
            </Card>
        </div>
    )
}
