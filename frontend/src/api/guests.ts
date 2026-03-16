import api from './client'

export interface Guest {
    id: number
    full_name: string
    source: string
    comment: string
}

export const guestsApi = {
    getAll: () => api.get<Guest[]>('/guests/').then(r => r.data),
    getOne: (id: number) => api.get<Guest>(`/guests/${id}/`).then(r => r.data),
    create: (data: Omit<Guest, 'id'>) => api.post<Guest>('/guests/', data).then(r => r.data),
    update: (id: number, data: Partial<Omit<Guest, 'id'>>) => api.put<Guest>(`/guests/${id}/`, data).then(r => r.data),
    delete: (id: number) => api.delete(`/guests/${id}/`),
}
