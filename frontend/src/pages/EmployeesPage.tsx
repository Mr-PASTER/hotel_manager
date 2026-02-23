import React, { useEffect, useState } from 'react'
import {
    Table, Button, Modal, Form, Input, Select, Tag,
    Space, Popconfirm, Tooltip, Switch, message, Divider
} from 'antd'
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    SearchOutlined, LockOutlined, KeyOutlined
} from '@ant-design/icons'
import { employeesApi, Employee } from '../api/employees'

const { Option } = Select

const roleConfig: Record<string, { label: string; color: string }> = {
    admin: { label: 'Администратор', color: 'var(--primary)' },
    cleaner: { label: 'Уборщик', color: 'var(--info)' },
    repair: { label: 'Ремонтник', color: 'var(--warning)' },
}

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterRole, setFilterRole] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [credModalOpen, setCredModalOpen] = useState(false)
    const [editEmp, setEditEmp] = useState<Employee | null>(null)
    const [credEmp, setCredEmp] = useState<Employee | null>(null)
    const [form] = Form.useForm()
    const [credForm] = Form.useForm()

    const load = async () => {
        setLoading(true)
        try { setEmployees(await employeesApi.getAll()) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    const handleSave = async (values: any) => {
        try {
            if (editEmp) {
                await employeesApi.update(editEmp.id, {
                    full_name: values.full_name,
                    role: values.role,
                    phone: values.phone,
                    active: values.active,
                    telegram_username: values.telegram_username,
                    nextcloud_username: values.nextcloud_username,
                })
                message.success('Сотрудник обновлён')
            } else {
                await employeesApi.create(values)
                message.success('Сотрудник добавлен')
            }
            setModalOpen(false)
            form.resetFields()
            setEditEmp(null)
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleCredSave = async (values: any) => {
        if (!credEmp) return
        if (!values.username && !values.password) {
            message.warning('Укажите новый логин или пароль')
            return
        }
        try {
            await employeesApi.updateCredentials(credEmp.id, {
                username: values.username || undefined,
                password: values.password || undefined,
            })
            message.success('Учётные данные обновлены')
            setCredModalOpen(false)
            credForm.resetFields()
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleDelete = async (id: number) => {
        await employeesApi.delete(id)
        message.success('Сотрудник удалён')
        load()
    }

    const filtered = employees.filter(e => {
        const matchSearch = e.full_name.toLowerCase().includes(search.toLowerCase()) ||
            (e.username || '').toLowerCase().includes(search.toLowerCase())
        const matchRole = filterRole ? e.role === filterRole : true
        return matchSearch && matchRole
    })

    const stats = {
        admin: employees.filter(e => e.role === 'admin').length,
        cleaner: employees.filter(e => e.role === 'cleaner').length,
        repair: employees.filter(e => e.role === 'repair').length,
        total: employees.filter(e => e.active).length,
    }

    const columns = [
        {
            title: 'ФИО',
            dataIndex: 'full_name',
            render: (v: string, r: Employee) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${roleConfig[r.role]?.color}20`,
                        border: `2px solid ${roleConfig[r.role]?.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: roleConfig[r.role]?.color,
                        flexShrink: 0,
                    }}>{v[0]}</div>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                        {r.username && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{r.username}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Роль',
            dataIndex: 'role',
            render: (v: string) => {
                const cfg = roleConfig[v]
                return <Tag style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, color: cfg.color }}>{cfg.label}</Tag>
            },
        },
        {
            title: 'Телефон',
            dataIndex: 'phone',
            render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v || '—'}</span>,
        },
        {
            title: 'Telegram @username',
            dataIndex: 'telegram_username',
            render: (v: string | null) => v ? `@${v}` : <span style={{ color: 'var(--text-muted)' }}>—</span>,
        },
        {
            title: 'NextCloud Username',
            dataIndex: 'nextcloud_username',
            render: (v: string | null) => v
                ? <span style={{ color: 'var(--info)' }}>☁ {v}</span>
                : <span style={{ color: 'var(--text-muted)' }}>—</span>,
        },
        {
            title: 'Статус',
            dataIndex: 'active',
            render: (v: boolean) => (
                <Tag style={{
                    background: v ? 'rgba(76,175,130,0.1)' : 'rgba(232,84,84,0.1)',
                    border: `1px solid ${v ? 'rgba(76,175,130,0.3)' : 'rgba(232,84,84,0.3)'}`,
                    color: v ? 'var(--success)' : 'var(--danger)',
                }}>
                    {v ? 'Активен' : 'Деактивирован'}
                </Tag>
            ),
        },
        {
            title: 'Действия',
            render: (_: any, record: Employee) => (
                <Space>
                    <Tooltip title="Изменить учётные данные">
                        <Button
                            type="text"
                            icon={<KeyOutlined />}
                            style={{ color: 'var(--primary)' }}
                            onClick={() => { setCredEmp(record); credForm.setFieldsValue({ username: record.username }); setCredModalOpen(true) }}
                        />
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={() => { setEditEmp(record); form.setFieldsValue(record); setModalOpen(true) }}
                        />
                    </Tooltip>
                    <Popconfirm title="Удалить сотрудника?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
                        <Button type="text" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Сотрудники</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>Управление персоналом и доступом</div>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditEmp(null); form.resetFields(); setModalOpen(true) }}
                    style={{ borderRadius: 8, height: 38 }}
                >
                    Добавить сотрудника
                </Button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Всего активных', value: stats.total, color: 'var(--success)' },
                    { label: 'Администраторы', value: stats.admin, color: 'var(--primary)' },
                    { label: 'Уборщики', value: stats.cleaner, color: 'var(--info)' },
                    { label: 'Ремонтники', value: stats.repair, color: 'var(--warning)' },
                ].map(s => (
                    <div key={s.label} className="stat-card" style={{ flex: 1 }}>
                        <div className="stat-icon" style={{ background: `${s.color}18` }}>
                            <span style={{ fontSize: 18, color: s.color }}>
                                {s.label.includes('Всего') ? '👥' : s.label.includes('Адм') ? '👑' : s.label.includes('Уб') ? '🧹' : '🔧'}
                            </span>
                        </div>
                        <div>
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label" style={{ color: s.color }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <Input
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Поиск по ФИО или логину..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: 280 }}
                    allowClear
                />
                <Select
                    value={filterRole || undefined}
                    onChange={v => setFilterRole(v || '')}
                    placeholder="Все роли"
                    allowClear
                    style={{ width: 180 }}
                >
                    {Object.entries(roleConfig).map(([k, v]) => (
                        <Option key={k} value={k}>{v.label}</Option>
                    ))}
                </Select>
            </div>

            <Table
                dataSource={filtered}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
                style={{ borderRadius: 12, overflow: 'hidden' }}
            />

            {/* Employees Modal */}
            <Modal
                title={editEmp ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditEmp(null); form.resetFields() }}
                footer={null}
                width={480}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
                    <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}>
                        <Input placeholder="Иванов Иван Иванович" />
                    </Form.Item>
                    <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
                        <Select placeholder="Выберите роль">
                            {Object.entries(roleConfig).map(([k, v]) => (
                                <Option key={k} value={k}>{v.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="phone" label="Телефон">
                        <Input placeholder="+7 (999) 000-00-00" />
                    </Form.Item>
                    <Form.Item name="telegram_username" label="Telegram Username (без @)">
                        <Input placeholder="ivan_ivanov_89" />
                    </Form.Item>
                    <Form.Item name="nextcloud_username" label="NextCloud Username">
                        <Input placeholder="ivan.ivanov" />
                    </Form.Item>

                    {!editEmp && (
                        <>
                            <Divider style={{ borderColor: 'var(--border)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Учётные данные для входа</span>
                            </Divider>
                            <Form.Item name="username" label="Логин">
                                <Input placeholder="username" />
                            </Form.Item>
                            <Form.Item name="password" label="Пароль">
                                <Input.Password placeholder="Минимум 6 символов" />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item name="active" label="Статус" valuePropName="checked" initialValue={true}>
                        <Switch checkedChildren="Активен" unCheckedChildren="Неактивен" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setModalOpen(false); setEditEmp(null); form.resetFields() }}>Отмена</Button>
                        <Button type="primary" htmlType="submit">{editEmp ? 'Сохранить' : 'Добавить'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* Credentials Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <KeyOutlined style={{ color: 'var(--primary)' }} />
                        <span>Учётные данные — {credEmp?.full_name}</span>
                    </div>
                }
                open={credModalOpen}
                onCancel={() => { setCredModalOpen(false); credForm.resetFields() }}
                footer={null}
                width={420}
            >
                <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, marginTop: 16 }}>
                    <div style={{ color: 'var(--warning)', fontSize: 12 }}>
                        ⚠️ Оставьте поле пустым, если не хотите его изменять
                    </div>
                </div>
                <Form form={credForm} layout="vertical" onFinish={handleCredSave}>
                    <Form.Item name="username" label="Новый логин">
                        <Input prefix={<LockOutlined />} placeholder="Оставьте пустым — без изменений" />
                    </Form.Item>
                    <Form.Item name="password" label="Новый пароль">
                        <Input.Password placeholder="Оставьте пустым — без изменений" />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setCredModalOpen(false); credForm.resetFields() }}>Отмена</Button>
                        <Button type="primary" htmlType="submit" icon={<KeyOutlined />}>Обновить</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
