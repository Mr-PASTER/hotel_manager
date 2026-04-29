import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Spin, Row, Col, Typography, Divider, Checkbox } from 'antd'
import { SaveOutlined, CloudServerOutlined, BellOutlined, FileTextOutlined } from '@ant-design/icons'
import api from '../api/client'

const { Title, Text } = Typography

interface AppConfig { key: string; value: string }

const DEFAULT_TEMPLATE =
    `🏨 Статус уборки номеров

✅ Чистые ({clean_count}):
{clean_rooms}

🧹 Требуют уборки ({dirty_count}):
{dirty_rooms}`

export default function SettingsPage() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            const { data } = await api.get<AppConfig[]>('/settings')
            const values: Record<string, any> = {}
            data.forEach(cfg => {
                const boolKeys = ['nc_enabled', 'notify_room_changes', 'notify_employee_changes']
                if (boolKeys.includes(cfg.key)) {
                    values[cfg.key] = cfg.value !== 'false'
                } else {
                    values[cfg.key] = cfg.value
                }
            })
            // Дефолтный шаблон, если не задан
            if (!values['template_room_status']) {
                values['template_room_status'] = DEFAULT_TEMPLATE
            }
            form.setFieldsValue(values)
        } catch {
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
        } catch {
            message.error('Ошибка сохранения')
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

                    {/* ── NextCloud Talk ────────────────────────── */}
                    <SectionHeader
                        icon={<CloudServerOutlined style={{ fontSize: 20, color: '#fff' }} />}
                        iconBg="var(--info)"
                        title="NextCloud Talk"
                        subtitle="Интеграция с NextCloud Talk для отправки отчётов"
                    />
                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col span={24} style={{ marginBottom: 16 }}>
                            <Form.Item name="nc_enabled" valuePropName="checked" style={{ margin: 0 }}>
                                <Checkbox>
                                    <Text strong>Включить отправку уведомлений в NextCloud Talk</Text>
                                </Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="nc_url" label="URL сервера NextCloud" extra="Например: https://cloud.example.com">
                                <Input placeholder="https://cloud.example.com" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="nc_bot_user" label="Логин бота (пользователь NC)">
                                <Input placeholder="hotel_bot" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="nc_bot_password" label="Пароль бота">
                                <Input.Password placeholder="••••••••" autoComplete="off" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="nc_room_token"
                                label="Token общей комнаты"
                                extra="Берётся из URL чата: /call/TOKEN"
                            >
                                <Input placeholder="abc123def456" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ── События уведомлений ──────────────────── */}
                    <SectionHeader
                        icon={<BellOutlined style={{ fontSize: 20, color: '#fff' }} />}
                        iconBg="var(--warning)"
                        title="Автоматические уведомления"
                        subtitle="Когда отправлять автоматические сообщения в чат"
                    />
                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="notify_room_changes" valuePropName="checked">
                                <Checkbox>Изменение статуса номеров</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="notify_employee_changes" valuePropName="checked">
                                <Checkbox>Изменения в сотрудниках</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ── Шаблон отчёта ───────────────────────── */}
                    <SectionHeader
                        icon={<FileTextOutlined style={{ fontSize: 20, color: '#1a1000' }} />}
                        iconBg="var(--primary)"
                        title="Шаблон отчёта о чистоте"
                        subtitle='Текст, отправляемый кнопкой "Отправить в чат" на панели уборки'
                    />
                    <Divider style={{ borderColor: 'var(--border)' }} />

                    {/* Подсказка по переменным */}
                    <div style={{
                        background: 'rgba(201,168,76,0.08)',
                        border: '1px solid rgba(201,168,76,0.25)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 16,
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>
                            📋 Доступные переменные:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
                            {[
                                ['{clean_rooms}',  'Список чистых номеров'],
                                ['{dirty_rooms}',  'Список грязных номеров'],
                                ['{clean_count}',  'Кол-во чистых'],
                                ['{dirty_count}',  'Кол-во грязных'],
                                ['{total}',        'Всего номеров'],
                            ].map(([v, d]) => (
                                <div key={v}>
                                    <code style={{
                                        color: 'var(--primary)',
                                        background: 'rgba(201,168,76,0.12)',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                    }}>{v}</code>
                                    {' — '}{d}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Form.Item name="template_room_status" label="Шаблон сообщения">
                        <Input.TextArea
                            rows={8}
                            placeholder={DEFAULT_TEMPLATE}
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                    </Form.Item>

                    <Button
                        type="text"
                        size="small"
                        style={{ color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}
                        onClick={() => form.setFieldsValue({ template_room_status: DEFAULT_TEMPLATE })}
                    >
                        Сбросить к дефолтному
                    </Button>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            size="large"
                            style={{ borderRadius: 8 }}
                        >
                            Сохранить настройки
                        </Button>
                    </div>

                </Form>
            </Card>
        </div>
    )
}

function SectionHeader({
    icon, iconBg, title, subtitle,
}: {
    icon: React.ReactNode
    iconBg: string
    title: string
    subtitle: string
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 20 }}>
            <div style={{
                width: 40, height: 40, background: iconBg, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>{title}</Title>
                <Text style={{ color: 'var(--text-muted)', fontSize: 13 }}>{subtitle}</Text>
            </div>
        </div>
    )
}
