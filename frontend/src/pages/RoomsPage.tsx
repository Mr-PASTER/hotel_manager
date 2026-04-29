import React, { useEffect, useState } from 'react'
import {
    Table, Button, Modal, Form, Input, Select, Tag, Space,
    Popconfirm, Tooltip, Row, Col, message
} from 'antd'
import {
    PlusOutlined, EditOutlined, DeleteOutlined,
    SearchOutlined, CalendarOutlined
} from '@ant-design/icons'
import { roomsApi, Room } from '../api/rooms'
import { bookingsApi } from '../api/bookings'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const { Option } = Select

const statusConfig: Record<string, { label: string; color: string }> = {
    free:     { label: 'Свободен',     color: 'var(--success)' },
    occupied: { label: 'Занят',        color: 'var(--danger)'  },
    booked:   { label: 'Забронирован', color: 'var(--info)'    },
}

const typeLabels: Record<string, string> = {
    single: 'Одноместный',
    double: 'Двухместный',
    suite:  'Люкс',
}

const cleanStatusConfig: Record<string, { label: string; color: string }> = {
    clean: { label: '✅ Чисто',  color: 'var(--success)' },
    dirty: { label: '🧹 Грязно', color: 'var(--warning)' },
}

export default function RoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editRoom, setEditRoom] = useState<Room | null>(null)
    const [form] = Form.useForm()
    const navigate = useNavigate()

    const load = async () => {
        setLoading(true)
        try {
            setRooms(await roomsApi.getAll())
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const handleBookedClick = async (room: Room) => {
        try {
            const bookings = await bookingsApi.getAll({ room_id: room.id })
            const today = dayjs()
            const active = bookings
                .filter(b => b.status === 'active' && dayjs(b.check_out).isAfter(today))
                .sort((a, b) => dayjs(a.check_in).diff(dayjs(b.check_in)))
            const target = active[0]
            if (target) {
                const d = dayjs(target.check_in)
                navigate('/calendar', { state: { highlightRoomId: room.id, year: d.year(), month: d.month() } })
            } else {
                navigate('/calendar')
            }
        } catch {
            navigate('/calendar')
        }
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

    const filtered = rooms.filter(r => {
        const matchSearch = r.number.toLowerCase().includes(search.toLowerCase())
        const actualStatus = r.actual_status || r.status
        const matchStatus = filterStatus ? actualStatus === filterStatus : true
        return matchSearch && matchStatus
    })

    const stats = {
        free:     rooms.filter(r => (r.actual_status || r.status) === 'free').length,
        occupied: rooms.filter(r => (r.actual_status || r.status) === 'occupied').length,
        booked:   rooms.filter(r => (r.actual_status || r.status) === 'booked').length,
        total:    rooms.length,
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
            render: (v: string) => (
                <Tag style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    {typeLabels[v] || v}
                </Tag>
            ),
        },
        {
            title: 'Статус',
            dataIndex: 'actual_status',
            render: (v: string, record: Room) => {
                const status = v || record.status
                const cfg = statusConfig[status] || { label: status, color: 'var(--text-muted)' }
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
                                onClick={() => handleBookedClick(record)}
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
            title: 'Чистота',
            dataIndex: 'clean_status',
            render: (v: string) => {
                const cfg = cleanStatusConfig[v] || cleanStatusConfig.clean
                return (
                    <span style={{ fontSize: 13, color: cfg.color, fontWeight: 500 }}>
                        {cfg.label}
                    </span>
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
                {[
                    { key: 'total',    label: 'Всего номеров', icon: '🏨', color: 'var(--primary)' },
                    { key: 'free',     label: 'Свободных',     icon: '✓',   color: 'var(--success)' },
                    { key: 'occupied', label: 'Занятых',       icon: '🏠',  color: 'var(--danger)'  },
                    { key: 'booked',   label: 'Забронировано', icon: '📅',  color: 'var(--info)'    },
                ].map(s => (
                    <Col key={s.key} xs={12} sm={12} md={6}>
                        <div
                            className="stat-card"
                            style={{ cursor: s.key !== 'total' ? 'pointer' : 'default', marginTop: 10 }}
                            onClick={() => s.key !== 'total' && setFilterStatus(filterStatus === s.key ? '' : s.key)}
                        >
                            <div className="stat-icon" style={{ background: `${s.color}18` }}>
                                <span style={{ fontSize: 20 }}>{s.icon}</span>
                            </div>
                            <div className="stat-value">{stats[s.key as keyof typeof stats]}</div>
                            <div className="stat-label" style={{ color: s.color }}>{s.label}</div>
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
                pagination={{ pageSize: 20, showSizeChanger: false }}
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
                                    <Option value="free">Свободен</Option>
                                    <Option value="occupied">Занят</Option>
                                    <Option value="booked">Забронирован</Option>
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
        </div>
    )
}
