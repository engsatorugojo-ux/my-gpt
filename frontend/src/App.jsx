import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import AuthPage from "./pages/AuthPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } });
  function login(token, u) { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(u)); setUser(u); }
  function logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); }
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage onLogin={login} />} />
      <Route path="/*"   element={user ? <ChatPage user={user} onLogout={logout} /> : <Navigate to="/auth" replace />} />
    </Routes>
  );
}
