import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Adjuntar token JWT en cada request
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refrescar token si expira
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = Cookies.get('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          Cookies.set('accessToken', data.accessToken, { expires: 7 });
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          Cookies.remove('accessToken');
          Cookies.remove('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: any) => api.post('/auth/register', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email/${token}`).then((r) => r.data),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
};

// ─── Careers ─────────────────────────────────────────────────
export const careersApi = {
  list: () => api.get('/careers').then((r) => r.data),
  get: (id: string) => api.get(`/careers/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/careers', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/careers/${id}`, data).then((r) => r.data),
};

// ─── Students ────────────────────────────────────────────────
export const studentsApi = {
  createProfile: (data: any) => api.post('/students/profile', data).then((r) => r.data),
  updateProfile: (data: any) => api.patch('/students/me', data).then((r) => r.data),
  myProfile: () => api.get('/students/me').then((r) => r.data).catch((e) => {
    if (e?.response?.status === 404) return null;
    throw e;
  }),
  list: (params?: any) => {
    const clean: any = {};
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) clean[k] = v; });
    return api.get('/students', { params: clean }).then((r) => r.data);
  },
  get: (id: string) => api.get(`/students/${id}`).then((r) => r.data),
  validateEligibility: (id: string, isEligible: boolean, notes?: string) =>
    api.patch(`/students/${id}/eligibility`, { isEligible, notes }).then((r) => r.data),
};

// ─── Advisors ────────────────────────────────────────────────
export const advisorsApi = {
  createProfile: (data: any) => api.post('/advisors/profile', data).then((r) => r.data),
  updateProfile: (id: string, data: any) => api.patch(`/advisors/${id}`, data).then((r) => r.data),
  myProfile: () => api.get('/advisors/me').then((r) => r.data),
  myWorks: () => api.get('/thesis-works').then((r) => r.data?.data ?? r.data),
  list: () => api.get('/advisors').then((r) => r.data),
  get: (id: string) => api.get(`/advisors/${id}`).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/advisors/${id}`, data).then((r) => r.data),
};

// ─── Thesis Works ────────────────────────────────────────────
export const thesisApi = {
  create: (data: any) => api.post('/thesis-works', data).then((r) => r.data),
  list: (params?: any) => {
    const clean: any = {};
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) clean[k] = v; });
    return api.get('/thesis-works', { params: clean }).then((r) => r.data);
  },
  get: (id: string) => api.get(`/thesis-works/${id}`).then((r) => r.data),
  getById: (id: string) => api.get(`/thesis-works/${id}`).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/thesis-works/${id}`, data).then((r) => r.data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/thesis-works/${id}/status`, { status, notes }).then((r) => r.data),
  submitProposal: (id: string, firma: string) =>
    api.patch(`/thesis-works/${id}/submit-proposal`, { firma }).then((r) => r.data),
  assignAdvisor: (id: string, advisorId: string) =>
    api.patch(`/thesis-works/${id}/assign-advisor`, { advisorId }).then((r) => r.data),
  metrics: () => api.get('/thesis-works/metrics').then((r) => r.data),
  monthlyStats: () => api.get('/thesis-works/stats/monthly').then((r) => r.data),
  exportCsv: async () => {
    const res = await api.get('/thesis-works/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trabajos-grado.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── Advances ────────────────────────────────────────────────
export const advancesApi = {
  create: (thesisWorkId: string, data: FormData) =>
    api.post(`/thesis-works/${thesisWorkId}/advances`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  list: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/advances`).then((r) => r.data),
  get: (thesisWorkId: string, id: string) =>
    api.get(`/thesis-works/${thesisWorkId}/advances/${id}`).then((r) => r.data),
  review: (thesisWorkId: string, id: string, data: any) =>
    api.patch(`/thesis-works/${thesisWorkId}/advances/${id}/review`, data).then((r) => r.data),
  addComment: (thesisWorkId: string, id: string, content: string) =>
    api.post(`/thesis-works/${thesisWorkId}/advances/${id}/comments`, { content }).then((r) => r.data),
};

// ─── Payments ────────────────────────────────────────────────
export const paymentsApi = {
  // Cobros: fija el monto y envía a Caja
  setAmount: (thesisWorkId: string, amount: number, notes?: string) =>
    api.patch(`/thesis-works/${thesisWorkId}/payment/set-amount`, { amount, notes }).then((r) => r.data),
  // Caja: confirma recepción del pago
  cajaConfirm: (thesisWorkId: string, notes?: string) =>
    api.patch(`/thesis-works/${thesisWorkId}/payment/caja-confirm`, { notes }).then((r) => r.data),
  reject: (thesisWorkId: string, reason: string) =>
    api.patch(`/thesis-works/${thesisWorkId}/payment/reject`, { reason }).then((r) => r.data),
  get: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/payment`).then((r) => r.data),
  listAll: (status?: string) =>
    api.get('/payments', { params: { status } }).then((r) => r.data),
  exportCsv: async () => {
    const res = await api.get('/payments/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── Presentations ───────────────────────────────────────────
export const presentationsApi = {
  schedule: (thesisWorkId: string, data: any) =>
    api.post(`/thesis-works/${thesisWorkId}/presentation/schedule`, data).then((r) => r.data),
  reschedule: (thesisWorkId: string, data: any) =>
    api.patch(`/thesis-works/${thesisWorkId}/presentation/reschedule`, data).then((r) => r.data),
  complete: (thesisWorkId: string) =>
    api.patch(`/thesis-works/${thesisWorkId}/presentation/complete`).then((r) => r.data),
  recordGrade: (thesisWorkId: string, data: any) =>
    api.post(`/thesis-works/${thesisWorkId}/presentation/grades`, data).then((r) => r.data),
  getGrades: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/presentation/grades`).then((r) => r.data),
  get: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/presentation`).then((r) => r.data),
};

// ─── Documents ───────────────────────────────────────────────
export const documentsApi = {
  upload: (thesisWorkId: string, data: FormData) =>
    api.post(`/thesis-works/${thesisWorkId}/documents`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  list: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/documents`).then((r) => r.data),
  download: (thesisWorkId: string, id: string) =>
    api.get(`/thesis-works/${thesisWorkId}/documents/${id}/download`).then((r) => r.data),
  delete: (thesisWorkId: string, id: string) =>
    api.delete(`/thesis-works/${thesisWorkId}/documents/${id}`).then((r) => r.data),
};

// ─── Repository ──────────────────────────────────────────────
export const repositoryApi = {
  list: (params?: any) => api.get('/repository', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/repository/${id}`).then((r) => r.data),
  stats: () => api.get('/repository/stats').then((r) => r.data),
};

// ─── Notifications ───────────────────────────────────────────
export const notificationsApi = {
  getAll: (page = 1, type?: string) =>
    api.get('/notifications', { params: { page, limit: 20, type: type || undefined } }).then((r) => r.data),
  getUnread: () => api.get('/notifications/unread').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

// ─── Users ───────────────────────────────────────────────────
export const usersApi = {
  list: (params?: any) => {
    const clean: any = {};
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) clean[k] = v; });
    return api.get('/users', { params: clean }).then((r) => r.data);
  },
  get: (id: string) => api.get(`/users/${id}`).then((r) => r.data),
  updateMe: (data: any) => api.patch('/users/me', data).then((r) => r.data),
  adminUpdate: (id: string, data: any) => api.patch(`/users/${id}`, data).then((r) => r.data),
  adminCreate: (data: any) => api.post('/users', data).then((r) => r.data),
};

// ─── Thesis Documents ────────────────────────────────────────
export const thesisDocumentsApi = {
  getOrCreate: (thesisWorkId: string, docType = 'THESIS') =>
    api.get(`/thesis-works/${thesisWorkId}/document`, { params: { docType } }).then((r) => r.data),
  listByWork: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/document/list`).then((r) => r.data),
  getStats: (thesisWorkId: string, docType = 'THESIS') =>
    api.get(`/thesis-works/${thesisWorkId}/document/stats`, { params: { docType } }).then((r) => r.data),
};

// ─── Exports ─────────────────────────────────────────────────
export const exportsApi = {
  downloadDocx: async (thesisWorkId: string) => {
    const res = await api.get(`/thesis-works/${thesisWorkId}/document/export/docx`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ?? 'tesis.docx';
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── Document Nodes ──────────────────────────────────────────
export const documentNodesApi = {
  // Tree from a document
  tree: (documentId: string) =>
    api.get(`/thesis-documents/${documentId}/nodes`).then((r) => r.data),
  create: (documentId: string, data: any) =>
    api.post(`/thesis-documents/${documentId}/nodes`, data).then((r) => r.data),
  reorder: (documentId: string, items: { id: string; order: number }[]) =>
    api.patch(`/thesis-documents/${documentId}/nodes/reorder`, { items }).then((r) => r.data),
  // Single node
  get: (id: string) => api.get(`/document-nodes/${id}`).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/document-nodes/${id}`, data).then((r) => r.data),
  move: (id: string, data: { parentId?: string | null; order: number }) =>
    api.patch(`/document-nodes/${id}/move`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/document-nodes/${id}`).then((r) => r.data),
  // State transitions
  start: (id: string) => api.patch(`/document-nodes/${id}/start`, {}).then((r) => r.data),
  submit: (id: string, notes?: string) =>
    api.patch(`/document-nodes/${id}/submit`, { notes }).then((r) => r.data),
  approve: (id: string, notes?: string) =>
    api.patch(`/document-nodes/${id}/approve`, { notes }).then((r) => r.data),
  returnNode: (id: string, notes?: string) =>
    api.patch(`/document-nodes/${id}/return`, { notes }).then((r) => r.data),
  // Comments
  addComment: (id: string, data: { content: string; blockId?: string; parentId?: string }) =>
    api.post(`/document-nodes/${id}/comments`, data).then((r) => r.data),
  resolveComment: (commentId: string) =>
    api.patch(`/document-nodes/comments/${commentId}/resolve`, {}).then((r) => r.data),
  // Versions
  listVersions: (id: string) => api.get(`/document-nodes/${id}/versions`).then((r) => r.data),
  saveVersion: (id: string, data?: { label?: string }) =>
    api.post(`/document-nodes/${id}/versions`, data ?? {}).then((r) => r.data),
};

// ─── Blocks ──────────────────────────────────────────────────
export const blocksApi = {
  list: (nodeId: string) =>
    api.get(`/document-nodes/${nodeId}/blocks`).then((r) => r.data),
  create: (nodeId: string, data: any) =>
    api.post(`/document-nodes/${nodeId}/blocks`, data).then((r) => r.data),
  reorder: (nodeId: string, items: { id: string; order: number }[]) =>
    api.patch(`/document-nodes/${nodeId}/blocks/reorder`, { items }).then((r) => r.data),
  get: (id: string) => api.get(`/blocks/${id}`).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/blocks/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/blocks/${id}`).then((r) => r.data),
  listVersions: (id: string) => api.get(`/blocks/${id}/versions`).then((r) => r.data),
  saveVersion: (id: string, message?: string) =>
    api.post(`/blocks/${id}/versions`, { message }).then((r) => r.data),
  restore: (id: string, versionNum: number) =>
    api.patch(`/blocks/${id}/restore/${versionNum}`, {}).then((r) => r.data),
};

// ─── Meetings ────────────────────────────────────────────────
export const meetingsApi = {
  list: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/meetings`).then((r) => r.data),
  create: (thesisWorkId: string, data: any) =>
    api.post(`/thesis-works/${thesisWorkId}/meetings`, data).then((r) => r.data),
  complete: (id: string, notes?: string) =>
    api.patch(`/meetings/${id}/complete`, { notes }).then((r) => r.data),
  cancel: (id: string) =>
    api.delete(`/meetings/${id}`).then((r) => r.data),
};

// ─── Audit ───────────────────────────────────────────────────
export const auditApi = {
  list: (params?: any) => api.get('/audit', { params }).then((r) => r.data),
};

// ─── Messages (Chat) ─────────────────────────────────────────
export const messagesApi = {
  list: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/messages`).then((r) => r.data),
  send: (thesisWorkId: string, content: string) =>
    api.post(`/thesis-works/${thesisWorkId}/messages`, { content }).then((r) => r.data),
  markRead: (thesisWorkId: string) =>
    api.patch(`/thesis-works/${thesisWorkId}/messages/read`).then((r) => r.data),
  unreadCount: (thesisWorkId: string) =>
    api.get(`/thesis-works/${thesisWorkId}/messages/unread`).then((r) => r.data),
};

// ─── Templates ───────────────────────────────────────────────
export const templatesApi = {
  list: (careerId?: string, docType?: string) =>
    api.get('/templates', { params: { careerId: careerId || undefined, docType: docType || undefined } }).then((r) => r.data),
  get: (id: string) => api.get(`/templates/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/templates', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/templates/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),
  setDefault: (id: string, careerId: string) =>
    api.patch(`/templates/${id}/set-default`, { careerId }).then((r) => r.data),
  addNode: (templateId: string, data: any) =>
    api.post(`/templates/${templateId}/nodes`, data).then((r) => r.data),
  reorderNodes: (templateId: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/${templateId}/nodes/reorder`, { items }).then((r) => r.data),
  updateNode: (nodeId: string, data: any) =>
    api.patch(`/templates/nodes/${nodeId}`, data).then((r) => r.data),
  removeNode: (nodeId: string) =>
    api.delete(`/templates/nodes/${nodeId}`).then((r) => r.data),
};
