import React, { useEffect, useState } from 'react'
import {
    Table, Button, Modal, Form, Input, InputNumber,
    Space, Popconfirm, Tooltip, Tag, message, Row, Col
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { guestsApi, Guest } from '../api/guests'
import { bookingsApi, Booking } from '../api/bookings'
import { roomsApi, Room } from '../api/rooms'

export default function GuestsPage() {
    const [guests, setGuests] = useState<Guest[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [bookings, setBookings] = useState<Record<number, Booking[]>>({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [bookingModalOpen, setBookingModalOpen] = useState(false)
    const [editGuest, setEditGuest] = useState<Guest | null>(null)
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
    const [form] = Form.useForm()
    const [bookingForm] = Form.useForm()

    const load = async () => {
        setLoading(true)
        try {
            const [g, r] = await Promise.all([guestsApi.getAll(), roomsApi.getAll()])
            setGuests(g)
            setRooms(r)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const handleSave = async (values: any) => {
        try {
            if (editGuest) {
                await guestsApi.update(editGuest.id, values)
                message.success('Данные гостя обновлены')
            } else {
                await guestsApi.create(values)
                message.success('Гость добавлен')
            }
            setModalOpen(false)
            form.resetFields()
            setEditGuest(null)
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await guestsApi.delete(id)
            message.success('Гость удалён')
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Нельзя удалить гостя с активными бронированиями')
        }
    }

    const handleAddBooking = async (values: any) => {
        if (!selectedGuest) return
        try {
            await bookingsApi.create({ ...values, guest_id: selectedGuest.id, status: 'active' })
            message.success('Бронирование создано')
            setBookingModalOpen(false)
            bookingForm.resetFields()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const filtered = guests.filter(g =>
        g.full_name.toLowerCase().includes(search.toLowerCase()) ||
        g.source.toLowerCase().includes(search.toLowerCase())
    )

    const columns = [
        {
            title: 'ФИО',
            dataIndex: 'full_name',
            render: (v: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(201,168,76,0.12)',
                        border: '2px solid rgba(201,168,76,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: 'var(--primary)', flexShrink: 0,
                    }}>{v[0]}</div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                </div>
            ),
        },
        {
            title: 'Источник',
            dataIndex: 'source',
            render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v || '—'}</span>,
        },
        {
            title: 'Комментарий',
            dataIndex: 'comment',
            render: (v: string) => (
                <Tooltip title={v}>
                    <span style={{ color: 'var(--text-muted)', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v || '—'}
                    </span>
                </Tooltip>
            ),
        },
        {
            title: 'Действия',
            render: (_: any, record: Guest) => (
                <Space>
                    <Tooltip title="Создать бронирование">
                        <Button
                            type="text"
                            icon={<span style={{ fontSize: 14 }}>📅</span>}
                            style={{ color: 'var(--primary)' }}
                            onClick={() => { setSelectedGuest(record); bookingForm.resetFields(); setBookingModalOpen(true) }}
                        />
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={() => { setEditGuest(record); form.setFieldsValue(record); setModalOpen(true) }}
                        />
                    </Tooltip>
                    <Popconfirm title="Удалить гостя?" onConfirm={() => handleDelete(record.id)} okText="Да" cancelText="Нет">
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
                    <div className="page-title">Гости</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>Управление записями гостей</div>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditGuest(null); form.resetFields(); setModalOpen(true) }}
                    style={{ borderRadius: 8, height: 38 }}
                >
                    Добавить гостя
                </Button>
            </div>

            {/* Stats */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(201,168,76,0.12)' }}>
                            <UserOutlined style={{ color: 'var(--primary)', fontSize: 20 }} />
                        </div>
                        <div>
                            <div className="stat-value">{guests.length}</div>
                            <div className="stat-label" style={{ color: 'var(--primary)' }}>Всего гостей</div>
                        </div>
                    </div>
                </Col>
            </Row>

            <Input
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder="Поиск по ФИО или источнику..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 320, marginBottom: 20 }}
                allowClear
            />

            <Table
                dataSource={filtered}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                scroll={{ x: 'max-content' }}
                style={{ borderRadius: 12, overflow: 'hidden' }}
            />

            {/* Guest Modal */}
            <Modal
                title={editGuest ? 'Редактировать гостя' : 'Новый гость'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setEditGuest(null); form.resetFields() }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
                    <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: 'Укажите ФИО' }]}>
                        <Input placeholder="Иванов Иван Иванович" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col xs={24} sm={24}>
                            <Form.Item name="source" label="Источник / От кого">
                                <Input placeholder="Через сайт, рекомендация и т.д." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="comment" label="Комментарий">
                        <Input.TextArea rows={3} placeholder="Дополнительная информация о госте..." />
                    </Form.Item>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setModalOpen(false); setEditGuest(null); form.resetFields() }}>Отмена</Button>
                        <Button type="primary" htmlType="submit">{editGuest ? 'Сохранить' : 'Добавить'}</Button>
                    </div>
                </Form>
            </Modal>

            {/* Booking Modal */}
            <Modal
                title={`Бронирование для: ${selectedGuest?.full_name}`}
                open={bookingModalOpen}
                onCancel={() => { setBookingModalOpen(false); bookingForm.resetFields() }}
                footer={null}
                width={420}
            >
                <Form form={bookingForm} layout="vertical" onFinish={handleAddBooking} style={{ marginTop: 16 }}>
                    <Form.Item name="room_id" label="Номер" rules={[{ required: true }]}>
                        <select style={{
                            width: '100%', padding: '8px 12px',
                            background: 'var(--bg-base)', border: '1px solid var(--border)',
                            borderRadius: 8, color: 'var(--text-primary)', fontSize: 14,
                        }}>
                            <option value="">Выберите номер...</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>№{r.number} — {r.floor} этаж ({r.type})</option>
                            ))}
                        </select>
                    </Form.Item>
                    <Row gutter={12}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="check_in" label="Заезд" rules={[{ required: true }]}>
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="check_out" label="Выезд" rules={[{ required: true }]}>
                                <Input type="date" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setBookingModalOpen(false); bookingForm.resetFields() }}>Отмена</Button>
                        <Button type="primary" htmlType="submit">Создать бронирование</Button>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}
