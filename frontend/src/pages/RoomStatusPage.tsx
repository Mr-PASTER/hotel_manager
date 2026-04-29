import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Button, Input, Switch, message, Spin } from 'antd'
import {
    SendOutlined,
    SearchOutlined,
    VerticalAlignTopOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SaveOutlined,
} from '@ant-design/icons'
import { roomsApi, Room } from '../api/rooms'
import api from '../api/client'

type CleanStatus = 'clean' | 'dirty'

interface RoomWithPending extends Room {
    pendingStatus: CleanStatus
    changed: boolean
}

export default function RoomStatusPage() {
    const [rooms, setRooms] = useState<RoomWithPending[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sending, setSending] = useState(false)
    const [search, setSearch] = useState('')
    const [showScrollTop, setShowScrollTop] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await roomsApi.getAll()
            setRooms(
                data
                    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                    .map(r => ({
                        ...r,
                        pendingStatus: (r.clean_status as CleanStatus) || 'clean',
                        changed: false,
                    }))
            )
        } catch {
            message.error('Ошибка загрузки номеров')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    // Scroll tracker
    useEffect(() => {
        const el = listRef.current
        if (!el) return
        const handler = () => setShowScrollTop(el.scrollTop > 200)
        el.addEventListener('scroll', handler)
        return () => el.removeEventListener('scroll', handler)
    }, [])

    const scrollToTop = () => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

    const setRoomStatus = (id: number, newStatus: CleanStatus) => {
        setRooms(prev => prev.map(r => {
            if (r.id !== id) return r
            return {
                ...r,
                pendingStatus: newStatus,
                changed: newStatus !== (r.clean_status as CleanStatus),
            }
        }))
    }

    const changedRooms = rooms.filter(r => r.changed)
    const changedCount = changedRooms.length

    /** Сохраняет изменённые статусы в БД */
    const handleSave = async () => {
        if (changedCount === 0) {
            message.info('Нет изменений для сохранения')
            return
        }
        setSaving(true)
        try {
            await roomsApi.bulkUpdateCleanStatus(
                changedRooms.map(r => ({ room_id: r.id, clean_status: r.pendingStatus }))
            )
            message.success(`Сохранено ${changedCount} изменений`)
            await load()
        } catch {
            message.error('Ошибка сохранения')
        } finally {
            setSaving(false)
        }
    }

    /**
     * Сначала сохраняем текущие статусы, затем просим backend
     * сформировать отчёт по шаблону из настроек и отправить в NC Talk.
     */
    const handleSendToChat = async () => {
        setSending(true)
        try {
            // Если есть несохранённые изменения — сохраняем сначала
            if (changedCount > 0) {
                await roomsApi.bulkUpdateCleanStatus(
                    changedRooms.map(r => ({ room_id: r.id, clean_status: r.pendingStatus }))
                )
                await load()
            }

            // Вызываем backend — он сам читает шаблон и отправляет
            const { data } = await api.post<{ status: string; clean: number; dirty: number }>(
                '/rooms/send-status-report'
            )
            message.success(
                `Отчёт отправлен в NextCloud Talk ✓  (чистых: ${data.clean}, грязных: ${data.dirty})`
            )
        } catch (e: any) {
            const detail = e?.response?.data?.detail
            if (detail?.includes('не настроен')) {
                message.warning('NextCloud Talk не настроен — проверьте раздел «Настройки»')
            } else {
                message.error(detail || 'Ошибка отправки')
            }
        } finally {
            setSending(false)
        }
    }

    const filtered = rooms.filter(r =>
        r.number.toLowerCase().includes(search.toLowerCase())
    )

    const cleanCount = rooms.filter(r => r.pendingStatus === 'clean').length
    const dirtyCount = rooms.filter(r => r.pendingStatus === 'dirty').length

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                <Spin size="large" />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 96px)', maxWidth: 700, margin: '0 auto' }}>

            {/* ─── Заголовок ─── */}
            <div className="page-header" style={{ marginBottom: 16, flexShrink: 0 }}>
                <div>
                    <div className="page-title">Статус номеров</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                        Управление чистотой номерного фонда
                    </div>
                </div>
            </div>

            {/* ─── Счётчики ─── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={counterStyle('var(--success)')}>
                    <CheckCircleOutlined style={{ fontSize: 15 }} />
                    <span style={{ fontWeight: 700, fontSize: 18 }}>{cleanCount}</span>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>Чистых</span>
                </div>
                <div style={counterStyle('var(--danger)')}>
                    <CloseCircleOutlined style={{ fontSize: 15 }} />
                    <span style={{ fontWeight: 700, fontSize: 18 }}>{dirtyCount}</span>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>Грязных</span>
                </div>
                {changedCount > 0 && (
                    <div style={{ ...counterStyle('var(--warning)'), cursor: 'pointer' }} onClick={handleSave}>
                        <SaveOutlined style={{ fontSize: 15 }} />
                        <span style={{ fontWeight: 700, fontSize: 18 }}>{changedCount}</span>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Нажми — сохранить</span>
                    </div>
                )}
            </div>

            {/* ─── Кнопки ─── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={sending}
                    onClick={handleSendToChat}
                    style={{
                        borderRadius: 8, height: 40, flex: '1 1 auto',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        border: 'none', fontWeight: 600, minWidth: 170,
                        color: '#1a1000',
                    }}
                >
                    Отправить в чат
                </Button>
                {changedCount > 0 && (
                    <Button
                        loading={saving}
                        onClick={handleSave}
                        style={{
                            borderRadius: 8, height: 40, flex: '1 1 auto',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--primary)',
                            color: 'var(--primary)', fontWeight: 600, minWidth: 140,
                        }}
                    >
                        Сохранить ({changedCount})
                    </Button>
                )}
            </div>

            {/* ─── Поиск ─── */}
            <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <Input
                    prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Поиск по номеру..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    allowClear
                    style={{ borderRadius: 8 }}
                    size="large"
                />
            </div>

            {/* ─── Список ─── */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    position: 'relative',
                }}
            >
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        Номера не найдены
                    </div>
                ) : (
                    filtered.map((room, idx) => (
                        <RoomStatusRow
                            key={room.id}
                            room={room}
                            isLast={idx === filtered.length - 1}
                            onChange={newStatus => setRoomStatus(room.id, newStatus)}
                        />
                    ))
                )}
            </div>

            {/* ─── Scroll-to-top ─── */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    style={{
                        position: 'fixed', bottom: 24, right: 24,
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--primary)', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(201,168,76,0.4)',
                        zIndex: 100, color: '#1a1000', fontSize: 18,
                        transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    title="Наверх"
                >
                    <VerticalAlignTopOutlined />
                </button>
            )}
        </div>
    )
}

// ─── Строка номера ──────────────────────────────────────────────────────────
function RoomStatusRow({
    room, isLast, onChange,
}: {
    room: RoomWithPending
    isLast: boolean
    onChange: (s: CleanStatus) => void
}) {
    const isClean = room.pendingStatus === 'clean'
    const changed = room.changed

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: isLast ? 'none' : '1px solid var(--border)',
            transition: 'background 0.15s',
            background: changed ? 'rgba(201,168,76,0.05)' : 'transparent',
        }}>
            {/* Левая часть */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: isClean ? 'var(--success)' : 'var(--danger)',
                    boxShadow: isClean ? '0 0 6px rgba(76,175,130,0.5)' : '0 0 6px rgba(232,84,84,0.5)',
                    transition: 'background 0.2s, box-shadow 0.2s',
                }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        №{room.number}
                        {changed && (
                            <span style={{
                                marginLeft: 8, fontSize: 10, verticalAlign: 'middle',
                                background: 'rgba(201,168,76,0.2)',
                                border: '1px solid rgba(201,168,76,0.4)',
                                color: 'var(--primary)', borderRadius: 4, padding: '1px 5px',
                            }}>
                                изменено
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Этаж {room.floor} · {typeLabel(room.type)}
                    </div>
                </div>
            </div>

            {/* Правая часть */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{
                    fontSize: 13, fontWeight: 600, minWidth: 52, textAlign: 'right',
                    color: isClean ? 'var(--success)' : 'var(--danger)',
                    transition: 'color 0.2s',
                }}>
                    {isClean ? 'Чисто' : 'Грязно'}
                </span>
                <Switch
                    checked={isClean}
                    onChange={checked => onChange(checked ? 'clean' : 'dirty')}
                    style={{
                        background: isClean
                            ? 'linear-gradient(135deg, #4caf82, #3d9b6e)'
                            : 'linear-gradient(135deg, #e85454, #c43e3e)',
                        minWidth: 48,
                    }}
                />
            </div>
        </div>
    )
}

function typeLabel(type: string) {
    const m: Record<string, string> = { single: 'Одноместный', double: 'Двухместный', suite: 'Люкс' }
    return m[type] || type
}

function counterStyle(color: string): React.CSSProperties {
    return {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        color, fontWeight: 600,
        flex: '1 1 auto', minWidth: 90, justifyContent: 'center',
    }
}
