import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const authApi = {
  register: d => api.post("/api/auth/register", d),
  login:    d => api.post("/api/auth/login", d),
};
export const convsApi = {
  list:    ()       => api.get("/api/conversations"),
  create:  d        => api.post("/api/conversations", d),
  patch:   (id, d)  => api.patch(`/api/conversations/${id}`, d),
  delete:  id       => api.delete(`/api/conversations/${id}`),
  messages: id      => api.get(`/api/conversations/${id}/messages`),
};
export const chatApi = {
  send: (convId, message) => api.post(`/api/chat/${convId}`, { message }),
};
export const integrationsApi = {
  list:   ()        => api.get("/api/integrations"),
  create: d         => api.post("/api/integrations", d),
  update: (id, d)   => api.put(`/api/integrations/${id}`, d),
  delete: id        => api.delete(`/api/integrations/${id}`),
};
export const settingsApi = {
  get:       ()  => api.get("/api/settings"),
  save:      d   => api.put("/api/settings", d),
  getModels: ()  => api.get("/api/settings/models"),
};
