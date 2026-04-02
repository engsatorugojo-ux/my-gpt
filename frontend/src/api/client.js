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
  list:   ()            => api.get("/api/integrations"),
  save:   (name, d)     => api.put(`/api/integrations/${name}`, d),
  delete: name          => api.delete(`/api/integrations/${name}`),
};
