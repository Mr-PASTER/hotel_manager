import api from './client'

export interface Employee {
    id: number
    full_name: string
    role: 'cleaner' | 'repair' | 'admin'
    phone: string
    active: boolean
    username: string | null
    telegram_username: string | null
    nextcloud_username: string | null
    max_username: string | null
    notification_preference: 'telegram' | 'nextcloud' | 'max' | 'all'
}

export interface EmployeeCreate {
    full_name: string
    role: 'cleaner' | 'repair' | 'admin'
    phone?: string
    active?: boolean
    username?: string
    password?: string
    telegram_username?: string
    nextcloud_username?: string
    max_username?: string
    notification_preference?: 'telegram' | 'nextcloud' | 'max' | 'all'
}

export const employeesApi = {
    getAll: () => api.get<Employee[]>('/employees').then(r => r.data),
    getOne: (id: number) => api.get<Employee>(`/employees/${id}`).then(r => r.data),
    create: (data: EmployeeCreate) => api.post<Employee>('/employees', data).then(r => r.data),
    update: (id: number, data: Partial<EmployeeCreate>) => api.put<Employee>(`/employees/${id}`, data).then(r => r.data),
    updateCredentials: (id: number, data: { username?: string; password?: string }) =>
        api.put<Employee>(`/employees/${id}/credentials`, data).then(r => r.data),
    delete: (id: number) => api.delete(`/employees/${id}`),
}
