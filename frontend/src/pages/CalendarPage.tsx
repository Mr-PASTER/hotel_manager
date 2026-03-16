import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
    Button, Select, Modal, Form, Input, message,
    Popconfirm, Tooltip, Tag, Spin, Row, Col
} from 'antd'
import {
    LeftOutlined, RightOutlined, PlusOutlined,
    DeleteOutlined, EditOutlined, ReloadOutlined
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ru'
import { useLocation } from 'react-router-dom'
import { calendarApi, bookingsApi, BookingWithGuest, Booking } from '../api/bookings'
import { roomsApi, Room } from '../api/rooms'
import { guestsApi, Guest } from '../api/guests'

dayjs.locale('ru')

const { Option } = Select

const ROOM_COL_WIDTH = 110
const DAY_WIDTH = 38

const statusColors: Record<string, string> = {
    active: '#c9a84c',
    completed: '#4caf82',
    cancelled: '#e85454',
}

function getDaysInMonth(year: number, month: number): Dayjs[] {
    const days: Dayjs[] = []
    const start = dayjs(new Date(year, month, 1))
    const count = start.daysInMonth()
    for (let i = 0; i < count; i++) {
        days.push(start.add(i, 'day'))
    }
    return days
}

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(dayjs())
    const [rooms, setRooms] = useState<Room[]>([])
    const [guests, setGuests] = useState<Guest[]>([])
    const [bookings, setBookings] = useState<BookingWithGuest[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [editBooking, setEditBooking] = useState<BookingWithGuest | null>(null)
    const [createGuest, setCreateGuest] = useState(false)
    const [form] = Form.useForm()
    const location = useLocation()
    const [highlightRoomId, setHighlightRoomId] = useState<number | null>(null)
    const rowRefs = useRef<Record<number, HTMLDivElement | null>>({})

    // Состояния для двойного тапа по календарю
    const [selectionState, setSelectionState] = useState<'none' | 'check-in' | 'check-out'>('none')
    const [tempCheckIn, setTempCheckIn] = useState<Dayjs | null>(null)
    const [tempRoomId, setTempRoomId] = useState<number | null>(null)
    const [tempCheckOut, setTempCheckOut] = useState<Dayjs | null>(null)

    const year = currentDate.year()
    const month = currentDate.month()
    const days = getDaysInMonth(year, month)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const start = dayjs(new Date(year, month, 1)).format('YYYY-MM-DD')
            const end = dayjs(new Date(year, month + 1, 0)).format('YYYY-MM-DD')
            const [r, g, b] = await Promise.all([
                roomsApi.getAll(),
                guestsApi.getAll(),
                calendarApi.get({ start, end }),
            ])
            setRooms(r)
            setGuests(g)
            setBookings(b)
        } finally {
            setLoading(false)
        }
    }, [year, month])

    useEffect(() => { load() }, [load])

    // Обработка перехода из RoomsPage с highlightRoomId
    useEffect(() => {
        const state = location.state as { highlightRoomId?: number; year?: number; month?: number } | null
        if (state?.highlightRoomId) {
            setHighlightRoomId(state.highlightRoomId)
            if (state.year !== undefined && state.month !== undefined) {
                setCurrentDate(dayjs(new Date(state.year, state.month, 1)))
            }
            // Сбрасываем подсветку через 3 секунды
            const timer = setTimeout(() => setHighlightRoomId(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [location.state])

    // Прокрутка к подсвеченному номеру после загрузки
    useEffect(() => {
        if (highlightRoomId && !loading && rowRefs.current[highlightRoomId]) {
            rowRefs.current[highlightRoomId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [highlightRoomId, loading, rooms])

    const getBookingsForRoom = (roomId: number) =>
        bookings.filter(b => b.room_id === roomId)

    const getBookingSpan = (booking: BookingWithGuest) => {
        const monthStart = dayjs(new Date(year, month, 1))
        const monthEnd = dayjs(new Date(year, month + 1, 0))
        const checkIn = dayjs(booking.check_in)
        const checkOut = dayjs(booking.check_out)

        const startDay = checkIn.isBefore(monthStart) ? monthStart : checkIn
        const endDay = checkOut.isAfter(monthEnd) ? monthEnd : checkOut

        const startIdx = startDay.date() - 1
        const endIdx = endDay.date() - 1

        return { startIdx, endIdx, width: (endIdx - startIdx + 1) * DAY_WIDTH }
    }

    const handleSave = async (values: any) => {
        try {
            if (editBooking) {
                await bookingsApi.update(editBooking.id, values)
                message.success('Бронирование обновлено')
            } else {
                // Если выбрано создание нового гостя, убираем guest_id
                const bookingData: any = { ...values }
                if (createGuest || !values.guest_id) {
                    delete bookingData.guest_id
                    if (!values.guest_full_name) {
                        message.error('Укажите имя гостя')
                        return
                    }
                }
                await bookingsApi.create(bookingData)
                message.success('Бронирование создано')
            }
            setModalOpen(false)
            form.resetFields()
            setEditBooking(null)
            setCreateGuest(false)
            setSelectionState('none')
            setTempCheckIn(null)
            setTempRoomId(null)
            setTempCheckOut(null)
            load()
        } catch (e: any) {
            message.error(e?.response?.data?.detail || 'Ошибка')
        }
    }

    const handleDelete = async (id: number) => {
        await bookingsApi.delete(id)
        message.success('Бронирование удалено')
        load()
    }

    // Обработчик первого и второго тапа по ячейке дня (заменяем двойной клик на два одиночных)
    const handleDayClick = (day: Dayjs, roomId: number) => {
        const today = dayjs()

        // Не разрешаем выбирать даты в прошлом
        if (day.isBefore(today, 'day')) {
            message.warning('Нельзя выбрать дату в прошлом')
            return
        }

        if (selectionState === 'none') {
            // Первый тап — выбираем дату заезда
            setSelectionState('check-in')
            setTempCheckIn(day)
            setTempRoomId(roomId)
            setTempCheckOut(null)
            message.info('Выберите дату выезда (нажмите на ячейку)')
        } else if (selectionState === 'check-in') {
            // Второй тап — выбираем дату выезда
            if (roomId !== tempRoomId) {
                message.warning('Выберите дату в том же номере')
                return
            }
            if (day.isBefore(tempCheckIn!, 'day')) {
                message.warning('Дата выезда должна быть позже даты заезда')
                setSelectionState('none')
                setTempCheckIn(null)
                setTempRoomId(null)
                return
            }
            if (day.isSame(tempCheckIn!, 'day')) {
                message.warning('Дата выезда должна быть позже даты заезда')
                return
            }

            // Открываем модалку с предзаполненными датами
            setTempCheckOut(day)
            setSelectionState('none')
            setEditBooking(null)
            setCreateGuest(false)
            form.resetFields()
            form.setFieldsValue({
                room_id: roomId,
                check_in: tempCheckIn!.format('YYYY-MM-DD'),
                check_out: day.format('YYYY-MM-DD'),
            })
            setModalOpen(true)
        }
    }

    // Сброс выделения при клике вне ячеек
    const handleCalendarClick = (e: React.MouseEvent) => {
        if (selectionState !== 'none' && e.target === e.currentTarget) {
            setSelectionState('none')
            setTempCheckIn(null)
            setTempRoomId(null)
            message.info('Выброс отменён')
        }
    }

    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    const today = dayjs()

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Календарь бронирований</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                        {currentDate.format('MMMM YYYY')} — {bookings.length} бронирований
                    </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 8 }}>Обновить</Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => { setEditBooking(null); form.resetFields(); setModalOpen(true) }}
                        style={{ borderRadius: 8, height: 38 }}
                    >
                        Добавить бронь
                    </Button>
                </div>
            </div>

            {/* Month navigator */}
            <div className="month-navigator">
                <div className="month-label-group">
                    <Button
                        type="text"
                        icon={<LeftOutlined />}
                        onClick={() => setCurrentDate(d => d.subtract(1, 'month'))}
                        style={{ color: 'var(--text-primary)' }}
                    />
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', minWidth: 120, textAlign: 'center', textTransform: 'capitalize' }}>
                        {currentDate.format('MMMM YYYY')}
                    </div>
                    <Button
                        type="text"
                        icon={<RightOutlined />}
                        onClick={() => setCurrentDate(d => d.add(1, 'month'))}
                        style={{ color: 'var(--text-primary)' }}
                    />
                </div>
                <Button
                    size="small"
                    onClick={() => setCurrentDate(dayjs())}
                    style={{ borderRadius: 6, fontSize: 12 }}
                >
                    Сегодня
                </Button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                {Object.entries(statusColors).map(([k, color]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {k === 'active' ? 'Активно' : k === 'completed' ? 'Завершено' : 'Отменено'}
                        </span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
            ) : (
                <div style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflowX: 'auto',
                }} onClick={handleCalendarClick}>
                    {/* Header row with day numbers */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-elevated)' }}>
                        {/* Corner */}
                        <div style={{
                            width: ROOM_COL_WIDTH, minWidth: ROOM_COL_WIDTH,
                            padding: '10px 12px',
                            borderRight: '1px solid var(--border)',
                            fontSize: 11, color: 'var(--text-muted)',
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                            Номер
                        </div>
                        {/* Days */}
                        {days.map(day => {
                            const isToday = day.isSame(today, 'day')
                            const isSun = day.day() === 0
                            const isSat = day.day() === 6
                            return (
                                <div key={day.date()} style={{
                                    width: DAY_WIDTH, minWidth: DAY_WIDTH,
                                    textAlign: 'center',
                                    borderRight: '1px solid var(--border)',
                                    padding: '6px 2px',
                                    background: isToday ? 'rgba(201,168,76,0.12)' : undefined,
                                }}>
                                    <div style={{
                                        fontSize: 10,
                                        color: isSun ? 'var(--danger)' : isSat ? 'var(--warning)' : 'var(--text-muted)',
                                        marginBottom: 2,
                                    }}>{weekdays[day.day()]}</div>
                                    <div style={{
                                        fontSize: 13, fontWeight: isToday ? 700 : 500,
                                        color: isToday ? 'var(--primary)' : (isSun ? 'var(--danger)' : isSat ? 'var(--warning)' : 'var(--text-primary)'),
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: isToday ? 'rgba(201,168,76,0.2)' : undefined,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto',
                                    }}>{day.date()}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Room rows */}
                    {rooms.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                            Нет номеров. Добавьте номера в разделе «Номерной фонд»
                        </div>
                    ) : rooms.map(room => {
                        const roomBookings = getBookingsForRoom(room.id)
                        const isHighlighted = highlightRoomId === room.id
                        return (
                            <div
                                key={room.id}
                                ref={el => { rowRefs.current[room.id] = el }}
                                style={{
                                    display: 'flex',
                                    borderBottom: '1px solid var(--border)',
                                    minHeight: 52,
                                    position: 'relative',
                                    transition: 'background 0.15s, box-shadow 0.3s',
                                    boxShadow: isHighlighted ? 'inset 0 0 0 2px var(--info)' : undefined,
                                    background: isHighlighted ? 'rgba(100,149,237,0.08)' : undefined,
                                }}
                                onMouseEnter={e => !isHighlighted && (e.currentTarget.style.background = 'var(--bg-elevated)')}
                                onMouseLeave={e => !isHighlighted && (e.currentTarget.style.background = '')}
                            >
                                {/* Room label */}
                                <div style={{
                                    width: ROOM_COL_WIDTH, minWidth: ROOM_COL_WIDTH, maxWidth: ROOM_COL_WIDTH,
                                    borderRight: '1px solid var(--border)',
                                    padding: '10px 12px',
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>#{room.number}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{room.floor} эт.</div>
                                </div>

                                {/* Day cells */}
                                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                                    {days.map(day => {
                                        const isToday2 = day.isSame(today, 'day')
                                        const isSelectedCheckIn = selectionState !== 'none' && tempCheckIn?.isSame(day, 'day') && tempRoomId === room.id
                                        return (
                                            <div key={day.date()} onClick={() => handleDayClick(day, room.id)} style={{
                                                width: DAY_WIDTH, minWidth: DAY_WIDTH,
                                                borderRight: '1px solid rgba(42,47,66,0.4)',
                                                background: isToday2 ? 'rgba(201,168,76,0.04)' : undefined,
                                                cursor: 'pointer',
                                                position: 'relative',
                                            }}>
                                                {isSelectedCheckIn && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        background: 'rgba(201,168,76,0.3)',
                                                        border: '2px solid var(--primary)',
                                                        boxSizing: 'border-box',
                                                        borderRadius: 2,
                                                    }} />
                                                )}
                                            </div>
                                        )
                                    })}

                                    {/* Booking bars */}
                                    {roomBookings.map(booking => {
                                        const checkIn = dayjs(booking.check_in)
                                        const checkOut = dayjs(booking.check_out)
                                        const monthStart = dayjs(new Date(year, month, 1))
                                        const monthEnd = dayjs(new Date(year, month + 1, 0))

                                        // Skip if booking doesn't overlap with this month
                                        if (checkOut.isBefore(monthStart, 'day') || checkIn.isAfter(monthEnd, 'day')) return null

                                        const startDay = checkIn.isBefore(monthStart) ? monthStart : checkIn
                                        const endDay = checkOut.isAfter(monthEnd.add(1, 'day')) ? monthEnd : checkOut

                                        const startIdx = startDay.date() - 1
                                        const endIdx = endDay.date() - 1
                                        const width = (endIdx - startIdx + 1) * DAY_WIDTH - 4
                                        const left = startIdx * DAY_WIDTH + 2
                                        const color = statusColors[booking.status] || statusColors.active

                                        return (
                                            <Tooltip
                                                key={booking.id}
                                                title={
                                                    <div style={{ fontSize: 12 }}>
                                                        <div style={{ fontWeight: 700 }}>{booking.guest_full_name}</div>
                                                        <div>{dayjs(booking.check_in).format('DD.MM')} → {dayjs(booking.check_out).format('DD.MM.YYYY')}</div>
                                                    </div>
                                                }
                                            >
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left,
                                                        top: 6,
                                                        width,
                                                        height: 38,
                                                        background: `linear-gradient(90deg, ${color}dd, ${color}88)`,
                                                        borderRadius: 6,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        paddingLeft: 8,
                                                        paddingRight: 4,
                                                        zIndex: 2,
                                                        cursor: 'pointer',
                                                        boxShadow: `0 2px 8px ${color}44`,
                                                        border: `1px solid ${color}66`,
                                                        overflow: 'hidden',
                                                        gap: 4,
                                                    }}
                                                    onClick={() => {
                                                        setEditBooking(booking)
                                                        form.setFieldsValue({
                                                            room_id: booking.room_id,
                                                            guest_id: booking.guest_id,
                                                            check_in: booking.check_in,
                                                            check_out: booking.check_out,
                                                            status: booking.status,
                                                        })
                                                        setModalOpen(true)
                                                    }}
                                                >
                                                    <span style={{
                                                        color: '#fff',
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                                        flex: 1,
                                                    }}>
                                                        {booking.guest_full_name}
                                                    </span>
                                                    <Popconfirm
                                                        title="Удалить бронирование?"
                                                        onConfirm={(e: any) => { e?.stopPropagation(); handleDelete(booking.id) }}
                                                        okText="Да"
                                                        cancelText="Нет"
                                                    >
                                                        <DeleteOutlined
                                                            onClick={(e: any) => e.stopPropagation()}
                                                            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, flexShrink: 0 }}
                                                        />
                                                    </Popconfirm>
                                                </div>
                                            </Tooltip>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Booking Modal */}
            <Modal
                title={editBooking ? 'Редактировать бронирование' : 'Новое бронирование'}
                open={modalOpen}
                onCancel={() => {
                    setModalOpen(false)
                    setEditBooking(null)
                    setCreateGuest(false)
                    setSelectionState('none')
                    setTempCheckIn(null)
                    setTempRoomId(null)
                    setTempCheckOut(null)
                    form.resetFields()
                }}
                footer={null}
                width={520}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
                    <Form.Item name="room_id" label="Номер" rules={[{ required: true }]}>
                        <Select placeholder="Выберите номер">
                            {rooms.map(r => (
                                <Option key={r.id} value={r.id}>№{r.number} — {r.floor} этаж</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {!editBooking && (
                        <Form.Item label="Гость">
                            <Select
                                value={createGuest ? 'new' : (form.getFieldValue('guest_id') || 'existing')}
                                onChange={(val) => {
                                    if (val === 'new') {
                                        setCreateGuest(true)
                                        form.setFieldsValue({ guest_id: null })
                                    } else {
                                        setCreateGuest(false)
                                    }
                                }}
                            >
                                <Option value="existing">Выбрать из списка</Option>
                                <Option value="new">Создать нового</Option>
                            </Select>
                        </Form.Item>
                    )}

                    {!editBooking && createGuest ? (
                        <>
                            <Form.Item name="guest_full_name" label="ФИО гостя" rules={[{ required: true, message: 'Введите ФИО гостя' }]}>
                                <Input placeholder="Иванов Иван Иванович" />
                            </Form.Item>
                            <Row gutter={16}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="guest_source" label="Источник">
                                        <Input placeholder="Сайт, телефон..." />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="guest_group_size" label="Кол-во гостей" initialValue={1}>
                                        <Input type="number" min={1} />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="guest_comment" label="Комментарий">
                                <Input.TextArea rows={2} placeholder="Примечание..." />
                            </Form.Item>
                        </>
                    ) : (
                        <>
                            <Form.Item name="guest_id" label="Гость" rules={[{ required: !createGuest && !!editBooking }]} dependencies={['guest_id']}>
                                <Select
                                    placeholder="Выберите гостя"
                                    showSearch
                                    filterOption={(input, option) =>
                                        String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    disabled={!!editBooking}
                                >
                                    {guests.map(g => (
                                        <Option key={g.id} value={g.id}>{g.full_name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="group_size" label="Кол-во гостей в номере" initialValue={1}>
                                <Input type="number" min={1} />
                            </Form.Item>
                        </>
                    )}

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="check_in" label="Дата заезда" rules={[{ required: true }]}>
                                <Input type="date" min={dayjs().format('YYYY-MM-DD')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="check_out" label="Дата выезда" rules={[{ required: true }]}>
                                <Input type="date" min={dayjs().add(1, 'day').format('YYYY-MM-DD')} />
                            </Form.Item>
                        </Col>
                    </Row>
                    {editBooking && (
                        <Form.Item name="status" label="Статус">
                            <Select>
                                <Option value="active">Активно</Option>
                                <Option value="completed">Завершено</Option>
                                <Option value="cancelled">Отменено</Option>
                            </Select>
                        </Form.Item>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => {
                            setModalOpen(false)
                            setEditBooking(null)
                            setCreateGuest(false)
                            setSelectionState('none')
                            setTempCheckIn(null)
                            setTempRoomId(null)
                            setTempCheckOut(null)
                            form.resetFields()
                        }}>Отмена</Button>
                        <Button type="primary" htmlType="submit">{editBooking ? 'Сохранить' : 'Создать'}</Button>
                    </div>
                </Form>
            </Modal>
        </div >
    )
}
