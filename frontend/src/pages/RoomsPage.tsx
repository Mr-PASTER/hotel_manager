import React, { useEffect, useState } from 'react'
import {
    Table, Button, Modal, Form, Input, Select, Tag, Space,
    Popconfirm, Tooltip, Badge, Row, Col, message, Drawer
} from 'antd'
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    SearchOutlined, HomeOutlined, UserAddOutlined, CalendarOutlined
} from '@ant-design/icons'
import { roomsApi, Room } from '../api/rooms'
import { employeesApi, Employee } from '../api/employees'
import { assignmentsApi, Assignment } from '../api/assignments'
import { bookingsApi } from '../api/bookings'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Option } = Select

const statusConfig: Record<string, { label: string; color: string; badge: string }> = {
    free: { label: 'Свободен', color: 'var(--success)', badge: 'success' },
    occupied: { label: 'Занят', color: 'var(--danger)', badge: 'error' },
    booked: { label: 'Забронирован', color: 'var(--info)', badge: 'processing' },
    cleaning: { label: 'Уборка', color: 'var(--warning)', badge: 'warning' },
    repair: { label: 'Ремонт', color: 'var(--info)', badge: 'processing' },
}

const typeLabels: Record<string, string> = {
    single: 'Одноместный',
    double: 'Двухместный',
    suite: 'Люкс',
}

export default function RoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('')
    const [modalOpen, setModalOpen] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [editRoom, setEditRoom] = useState<Room | null>(null)
    const [form] = Form.useForm()
    const [assignForm] = Form.useForm()
    const navigate = useNavigate()

    const load = async () => {
        setLoading(true)
        try {
            const [r, e] = await Promise.all([roomsApi.getAll(), employeesApi.getAll()])
            setRooms(r)
            setEmployees(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const handleBookedStatusClick = async (room: Room) => {
        try {
            // Получаем все активные брони для этого номера
            const bookings = await bookingsApi.getAll({ room_id: room.id })
            const today = dayjs()
            // Ищем ближайшую бронь: сначала текущую/будущую, потом любую
            const activeBookings = bookings
                .filter(b => b.status === 'active' && dayjs(b.check_out).isAfter(today))
                .sort((a, b) => dayjs(a.check_in).diff(dayjs(b.check_in)))
            const target = activeBookings[0]
            if (target) {
                const d = dayjs(target.check_in)
                navigate('/calendar', {
                    state: { highlightRoomId: room.id, year: d.year(), month: d.month() }
                })
            } else {
                navigate('/calendar')
            }
        } catch {
            navigate('/calendar')
        }
    }

    const openAssign = async (room: Room) => {
        setSelectedRoom(room)
        const a = await assignmentsApi.getAll({ room_id: room.id })
        setAssignments(a)
        setDrawerOpen(true)
    }

    const handleSave = async (values: any) => {
        try {
            if (editRoom) {
                await roomsApi.update(editRoom.id, values)
                message.success('Номер обновлён')
            } else {
                await roomsApi.create(values)
                message.success('Номер добавлен')
            }
            setModalOpen(false)
            form.resetFields()
            setEditRoom(null)
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleDelete = async (id: number) => {
        await roomsApi.delete(id)
        message.success('Номер удалён')
        load()
    }

    const handleAddAssignment = async (values: any) => {
        try {
            await assignmentsApi.create({ ...values, room_id: selectedRoom!.id })
            const a = await assignmentsApi.getAll({ room_id: selectedRoom!.id })
            setAssignments(a)
            assignForm.resetFields()
            message.success('Сотрудник назначен')
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleDeleteAssignment = async (id: number) => {
        await assignmentsApi.delete(id)
        const a = await assignmentsApi.getAll({ room_id: selectedRoom!.id })
        setAssignments(a)
        message.success('Назначение удалено')
    }

    const filtered = rooms.filter(r => {
        const matchSearch = r.number.toLowerCase().includes(search.toLowerCase())
        const actualStatus = r.actual_status || r.status
        const matchStatus = filterStatus ? actualStatus === filterStatus : true
        return matchSearch && matchStatus
    })

    // Stats
    const stats = {
        free: rooms.filter(r => (r.actual_status || r.status) === 'free').length,
        occupied: rooms.filter(r => (r.actual_status || r.status) === 'occupied').length,
        booked: rooms.filter(r => (r.actual_status || r.status) === 'booked').length,
        cleaning: rooms.filter(r => (r.actual_status || r.status) === 'cleaning').length,
        repair: rooms.filter(r => (r.actual_status || r.status) === 'repair').length,
    }

    const columns = [
        {
            title: '№ Номера',
            dataIndex: 'number',
            render: (v: string) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>#{v}</span>,
        },
        {
            title: 'Этаж',
            dataIndex: 'floor',
            render: (v: number) => <span style={{ color: 'var(--text-secondary)' }}>{v} этаж</span>,
        },
        {
            title: 'Тип',
            dataIndex: 'type',
            render: (v: string) => <Tag style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>{typeLabels[v]}</Tag>,
        },
        {
            title: 'Статус',
            dataIndex: 'actual_status',
            render: (v: string, record: Room) => {
                const status = v || record.status
                const cfg = statusConfig[status]
                if (!cfg) return null
                // Статус "Забронирован" — кликабельный
                if (status === 'booked') {
                    return (
                        <Tooltip title="Перейти к брони в календаре">
                            <Tag
                                style={{
                                    background: `${cfg.color}18`,
                                    border: `1px solid ${cfg.color}40`,
                                    color: cfg.color,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                                onClick={() => handleBookedStatusClick(record)}
                            >
                                <CalendarOutlined style={{ fontSize: 11 }} />
                                {cfg.label}
                            </Tag>
                        </Tooltip>
                    )
                }
                return (
                    <Tag style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, color: cfg.color }}>
                        {cfg.label}
                    </Tag>
                )
            },
        },
        {
            title: 'Описание',
            dataIndex: 'description',
            render: (v: string) => <span style={{ color: 'var(--text-muted)' }}>{v || '—'}</span>,
        },
        {
            title: 'Действия',
            render: (_: any, record: Room) => (
                <Space>
                    <Tooltip title="Назначить сотрудника">
                        <Button
                            type="text"
                            icon={<UserAddOutlined />}
                            onClick={() => openAssign(record)}
                            style={{ color: 'var(--primary)' }}
                        />
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => { setEditRoom(record); form.setFieldsValue(record); setModalOpen(true) }}
                            style={{ color: 'var(--text-secondary)' }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Удалить номер?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Да"
                        cancelText="Нет"
                    >
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
                    <div className="page-title">Номерной фонд</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                        Управление номерами отеля
                    </div>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditRoom(null); form.resetFields(); setModalOpen(true) }}
                    style={{ borderRadius: 8, height: 38 }}
                >
                    Добавить номер
                </Button>
            </div>

            {/* Stats */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                    <Col key={key} xs={12} sm={12} md={6}>
                        <div className="stat-card" style={{ cursor: 'pointer', marginTop: 10 }} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}>
                            <div className="stat-icon" style={{ background: `${cfg.color}18` }}>
                                <span style={{ fontSize: 20 }}>
                                    {key === 'free' ? '✓' : key === 'occupied' ? '🏠' : key === 'booked' ? '📅' : key === 'cleaning' ? '🧹' : '🔧'}
                                </span>
                            </div>
                            <div className="stat-value">{stats[key as keyof typeof stats]}</div>
                            <div className="stat-label" style={{ color: cfg.color }}>{cfg.label}</div>
                        </div>
                    </Col>
                ))}
            </Row>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <Input
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Поиск по номеру..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ maxWidth: 280 }}
                    allowClear
                />
                <Select
                    value={filterStatus || undefined}
                    onChange={v => setFilterStatus(v || '')}
                    placeholder="Все статусы"
                    allowClear
                    style={{ width: 180 }}
                >
                    {Object.entries(statusConfig).map(([k, v]) => (
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

            {/* Room Modal */}
            <Modal
                title={editRoom ? 'Редактировать номер' : 'Добавить номер'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditRoom(null); form.resetFields() }}
                footer={null}
                width={480}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="number" label="Номер комнаты" rules={[{ required: true }]}>
                                <Input placeholder="101" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="floor" label="Этаж" rules={[{ required: true }]}>
                                <Input type="number" min={1} placeholder="1" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="type" label="Тип" initialValue="single">
                                <Select>
                                    <Option value="single">Одноместный</Option>
                                    <Option value="double">Двухместный</Option>
                                    <Option value="suite">Люкс</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="status" label="Статус" initialValue="free">
                                <Select>
                                    {Object.entries(statusConfig).map(([k, v]) => (
                                        <Option key={k} value={k}>{v.label}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="description" label="Описание">
                        <Input.TextArea rows={3} placeholder="Дополнительная информация..." />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setModalOpen(false); setEditRoom(null); form.resetFields() }}>Отмена</Button>
                        <Button type="primary" htmlType="submit">{editRoom ? 'Сохранить' : 'Добавить'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* Assignments Drawer */}
            <Drawer
                title={`Назначения — Номер #${selectedRoom?.number}`}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={480}
                styles={{ body: { background: 'var(--bg-base)', padding: 20 } }}
            >
                <Form form={assignForm} layout="vertical" onFinish={handleAddAssignment}>
                    <Row gutter={12}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="employee_id" label="Сотрудник" rules={[{ required: true }]}>
                                <Select placeholder="Выбрать...">
                                    {employees.filter(e => e.active).map(e => (
                                        <Option key={e.id} value={e.id}>{e.full_name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="cleaning">Уборка</Option>
                                    <Option value="repair">Ремонт</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={12}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="date" label="Дата" rules={[{ required: true }]}>
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="note" label="Заметка">
                                <Input placeholder="..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                        Назначить
                    </Button>
                </Form>

                <div style={{ marginTop: 24 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Назначенные сотрудники
                    </div>
                    {assignments.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Нет назначений</div>
                    ) : (
                        assignments.map(a => (
                            <div key={a.id} style={{
                                background: a.completed ? 'rgba(76,175,130,0.06)' : 'var(--bg-card)',
                                border: `1px solid ${a.completed ? 'rgba(76,175,130,0.3)' : 'var(--border)'}`,
                                borderRadius: 10,
                                padding: '12px 16px',
                                marginBottom: 10,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.employee_full_name}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                                            {dayjs(a.date).format('DD.MM.YYYY')} · {a.type === 'cleaning' ? 'Уборка' : 'Ремонт'}
                                            {a.note && ` · ${a.note}`}
                                        </div>
                                    </div>
                                    <Space>
                                        {a.completed ? (
                                            <Tag style={{
                                                background: 'rgba(76,175,130,0.1)',
                                                border: '1px solid rgba(76,175,130,0.3)',
                                                color: 'var(--success)',
                                            }}>
                                                ✅ {a.completed_at ? dayjs(a.completed_at).format('DD.MM HH:mm') : 'Завершено'}
                                            </Tag>
                                        ) : (
                                            <Popconfirm
                                                title="Отметить задание как завершённое?"
                                                onConfirm={async () => {
                                                    try {
                                                        await assignmentsApi.complete(a.id)
                                                        const updated = await assignmentsApi.getAll({ room_id: selectedRoom!.id })
                                                        setAssignments(updated)
                                                        message.success('Задание завершено!')
                                                        load()
                                                    } catch (e: any) {
                                                        message.error(e?.response?.data?.detail || 'Ошибка')
                                                    }
                                                }}
                                                okText="Да"
                                                cancelText="Нет"
                                            >
                                                <Button type="primary" size="small" ghost style={{ borderRadius: 6, fontSize: 12 }}>
                                                    Завершить
                                                </Button>
                                            </Popconfirm>
                                        )}
                                        <Popconfirm title="Удалить?" onConfirm={() => handleDeleteAssignment(a.id)} okText="Да" cancelText="Нет">
                                            <Button type="text" icon={<DeleteOutlined />} danger size="small" />
                                        </Popconfirm>
                                    </Space>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Drawer>
        </div>
    )
}
