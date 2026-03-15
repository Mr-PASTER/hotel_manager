import api from './client'

export interface Assignment {
    id: number
    room_id: number
    employee_id: number
    date: string
    type: 'cleaning' | 'repair'
    note: string
    employee_full_name?: string
    completed: boolean
    completed_at?: string | null
}

export const assignmentsApi = {
    getAll: (params?: { room_id?: number; employee_id?: number }) =>
        api.get<Assignment[]>('/assignments', { params }).then(r => r.data),
    create: (data: Omit<Assignment, 'id' | 'employee_full_name' | 'completed' | 'completed_at'>) =>
        api.post<Assignment>('/assignments', data).then(r => r.data),
    complete: (id: number) =>
        api.post<Assignment>(`/assignments/${id}/complete`).then(r => r.data),
    delete: (id: number) => api.delete(`/assignments/${id}`),
}
