// src/store/staffStore.ts
import { create } from 'zustand';
import type { StaffMember, UserRole } from '../types';
import { api, ApiError } from '../api/client';

interface StaffRaw {
  id: string;
  login: string;
  role: UserRole;
  name?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

function mapStaff(raw: StaffRaw): StaffMember {
  return {
    id: raw.id,
    login: raw.login,
    password: '', // not returned by API
    role: raw.role,
    name: raw.name,
    phone: raw.phone,
    notes: raw.notes,
    createdAt: raw.created_at,
  };
}

interface StaffState {
  staff: StaffMember[];
  loading: boolean;

  fetchStaff: () => Promise<void>;
  addStaff: (data: {
    login: string;
    password: string;
    role: UserRole;
    name?: string;
    phone?: string;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateStaff: (
    id: string,
    data: { role?: UserRole; name?: string; phone?: string; notes?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  removeStaff: (id: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (id: string) => Promise<{ success: boolean; newPassword?: string; error?: string }>;
}

export const useStaffStore = create<StaffState>()((set) => ({
  staff: [],
  loading: false,

  fetchStaff: async () => {
    set({ loading: true });
    try {
      const raw = await api.get<StaffRaw[]>('/api/staff');
      set({ staff: raw.map(mapStaff) });
    } finally {
      set({ loading: false });
    }
  },

  addStaff: async (data) => {
    try {
      const raw = await api.post<StaffRaw>('/api/staff', data);
      set((s) => ({ staff: [...s.staff, mapStaff(raw)] }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'Ошибка создания' };
    }
  },

  updateStaff: async (id, data) => {
    try {
      const raw = await api.patch<StaffRaw>(`/api/staff/${id}`, data);
      set((s) => ({ staff: s.staff.map((m) => (m.id === id ? mapStaff(raw) : m)) }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'Ошибка обновления' };
    }
  },

  removeStaff: async (id) => {
    try {
      await api.delete(`/api/staff/${id}`);
      set((s) => ({ staff: s.staff.filter((m) => m.id !== id) }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'Ошибка удаления' };
    }
  },

  resetPassword: async (id) => {
    try {
      const res = await api.post<{ new_password: string }>(`/api/staff/${id}/reset-password`);
      return { success: true, newPassword: res.new_password };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.message : 'Ошибка сброса пароля' };
    }
  },
}));
