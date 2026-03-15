import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message, Spin, Row, Col, Typography, Divider, Checkbox } from 'antd'
import { SaveOutlined, SettingOutlined, CloudServerOutlined, MessageOutlined, BellOutlined, EditOutlined } from '@ant-design/icons'
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
            const initialValues: Record<string, any> = {}
            data.forEach(cfg => {
                if (['notify_assignment_created', 'notify_assignment_completed', 'notify_room_changes', 'notify_employee_changes', 'notify_reminders'].includes(cfg.key)) {
                    initialValues[cfg.key] = cfg.value === 'true'
                } else {
                    initialValues[cfg.key] = cfg.value
                }
            })
            
            // Default templates if not set
            const templates = [
                'template_assignment_group',
                'template_assignment_personal',
                'template_assignment_completed',
                'template_reminder'
            ]
            templates.forEach(t => {
                if (!initialValues[t]) {
                    if (t === 'template_assignment_group') initialValues[t] = "🏨 Новое назначение для {name}:\nНомер #{number}, тип: {type}\n📅 Дата: {date}"
                    if (t === 'template_assignment_personal') initialValues[t] = "Вам назначена новая задача!\n\n🛏 Номер: #{number}\n🛠 Тип: {type}\n📅 Дата: {date}"
                    if (t === 'template_assignment_completed') initialValues[t] = "✅ Задание завершено!\nСотрудник: {name}\nНомер: #{number}\nЗавершено: {date}"
                    if (t === 'template_reminder') initialValues[t] = "⏰ Напоминание! Сегодня ваш день выхода:\n\n🛏 Номер: #{number}\n🛠 Тип: {type}\n📅 Дата: {date}"
                }
            })
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
                                <Input.Password placeholder="123456789:ABCDefgh..." autoComplete="off" />
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
                                <Input.Password placeholder="••••••••" autoComplete="off" />
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

                    {/* ── MAX ────────────────────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--success)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageOutlined style={{ fontSize: 20, color: '#fff' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>MAX интеграция</Title>
                            <Text style={{ color: 'var(--text-muted)' }}>Новый русский мессенджер</Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="max_bot_token"
                                label="Bot Token (Токен бота MAX)"
                                extra="Токен бота для доступа к API MAX"
                            >
                                <Input.Password placeholder="Введите токен..." autoComplete="off" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="max_group_chat_id"
                                label="MAX Group Chat ID"
                                extra="ID группы, куда отправлять общие логи"
                            >
                                <Input placeholder="chat123abc" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ── События уведомлений (Триггеры) ───────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--warning)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BellOutlined style={{ fontSize: 20, color: '#fff' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>События уведомлений</Title>
                            <Text style={{ color: 'var(--text-muted)' }}>Выберите, о каких событиях отправлять уведомления</Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col xs={12} sm={8}>
                            <Form.Item name="notify_assignment_created" valuePropName="checked">
                                <Checkbox>Новые назначения</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Form.Item name="notify_assignment_completed" valuePropName="checked">
                                <Checkbox>Завершения назначений</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Form.Item name="notify_room_changes" valuePropName="checked">
                                <Checkbox>Изменение статуса номеров</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Form.Item name="notify_employee_changes" valuePropName="checked">
                                <Checkbox>Изменения сотрудников</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Form.Item name="notify_reminders" valuePropName="checked">
                                <Checkbox>Ежедневные напоминания</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    {/* ── Шаблоны сообщений ──────────────────────── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, marginTop: 16 }}>
                        <div style={{ width: 40, height: 40, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <EditOutlined style={{ fontSize: 20, color: '#1a1000' }} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>Шаблоны сообщений</Title>
                            <Text style={{ color: 'var(--text-muted)' }}>Настройте текст уведомлений (используйте {`{name}, {number}, {type}, {date}, {note}`})</Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'var(--border)' }} />

                    <Row gutter={24}>
                        <Col span={24}>
                            <Form.Item 
                                name="template_assignment_group" 
                                label="Новое назначение (в группу)"
                                extra="Переменные: {name}, {number}, {type}, {date}"
                            >
                                <Input.TextArea rows={3} placeholder="🏨 Новое назначение для {name}..." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item 
                                name="template_assignment_personal" 
                                label="Новое назначение (личное)"
                                extra="Переменные: {number}, {type}, {date}"
                            >
                                <Input.TextArea rows={3} placeholder="Вам назначена новая задача!.." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item 
                                name="template_assignment_completed" 
                                label="Завершение задания (в логи)"
                                extra="Переменные: {name}, {number}, {date}"
                            >
                                <Input.TextArea rows={3} placeholder="✅ Задание завершено!.." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item 
                                name="template_reminder" 
                                label="Ежедневное напоминание"
                                extra="Переменные: {number}, {type}, {date}"
                            >
                                <Input.TextArea rows={3} placeholder="⏰ Напоминание!.." />
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
