import api from './client'

export interface Room {
    id: number
    number: string
    floor: number
    type: 'single' | 'double' | 'suite'
    status: 'free' | 'occupied' | 'booked' | 'cleaning' | 'repair'
    description: string
    actual_status?: string
}

export const roomsApi = {
    getAll: () => api.get<Room[]>('/rooms').then(r => r.data),
    getOne: (id: number) => api.get<Room>(`/rooms/${id}`).then(r => r.data),
    create: (data: Omit<Room, 'id'>) => api.post<Room>('/rooms', data).then(r => r.data),
    update: (id: number, data: Partial<Room>) => api.put<Room>(`/rooms/${id}`, data).then(r => r.data),
    delete: (id: number) => api.delete(`/rooms/${id}`),
}
