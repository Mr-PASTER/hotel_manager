import api from './client'

export interface Room {
    id: number
    number: string
    floor: number
    type: 'single' | 'double' | 'suite'
    status: 'free' | 'occupied' | 'booked'
    clean_status: 'clean' | 'dirty'
    description: string
    actual_status?: string
}

export const roomsApi = {
    getAll: () => api.get<Room[]>('/rooms/').then(r => r.data),
    getOne: (id: number) => api.get<Room>(`/rooms/${id}/`).then(r => r.data),
    create: (data: Omit<Room, 'id' | 'actual_status'>) => api.post<Room>('/rooms/', data).then(r => r.data),
    update: (id: number, data: Partial<Room>) => api.put<Room>(`/rooms/${id}/`, data).then(r => r.data),
    delete: (id: number) => api.delete(`/rooms/${id}/`),
    updateCleanStatus: (id: number, clean_status: 'clean' | 'dirty') =>
        api.patch<Room>(`/rooms/${id}/clean-status`, null, { params: { clean_status } }).then(r => r.data),
    bulkUpdateCleanStatus: (items: { room_id: number; clean_status: 'clean' | 'dirty' }[]) =>
        api.post('/rooms/bulk-clean-status', items).then(r => r.data),
}
