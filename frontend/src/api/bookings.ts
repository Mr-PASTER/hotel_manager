import api from './client'

export interface Booking {
    id: number
    room_id: number
    guest_id: number | null
    check_in: string
    check_out: string
    group_size: number
    status: 'active' | 'completed' | 'cancelled'
}

export interface BookingWithGuest extends Booking {
    guest_full_name: string
}

export interface BookingCreate {
    room_id: number
    guest_id?: number | null
    check_in: string
    check_out: string
    group_size?: number
    status?: 'active' | 'completed' | 'cancelled'
    guest_full_name?: string
    guest_source?: string
    guest_comment?: string
}

export const bookingsApi = {
    getAll: (params?: { room_id?: number; guest_id?: number }) =>
        api.get<Booking[]>('/bookings/', { params }).then(r => r.data),
    getOne: (id: number) => api.get<Booking>(`/bookings/${id}/`).then(r => r.data),
    create: (data: BookingCreate) => api.post<Booking>('/bookings/', data).then(r => r.data),
    update: (id: number, data: Partial<Omit<Booking, 'id'>>) =>
        api.put<Booking>(`/bookings/${id}/`, data).then(r => r.data),
    delete: (id: number) => api.delete(`/bookings/${id}/`),
}

export const calendarApi = {
    get: (params?: { start?: string; end?: string; room_id?: number }) =>
        api.get<BookingWithGuest[]>('/calendar/', { params }).then(r => r.data),
}
