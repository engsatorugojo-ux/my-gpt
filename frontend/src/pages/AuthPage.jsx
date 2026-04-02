import { useState } from "react";
import { authApi } from "../api/client.js";

export default function AuthPage({ onLogin }) {
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ email: "", password: "", name: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setError(""); }

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = mode === "login"
        ? await authApi.login({ email: form.email, password: form.password })
        : await authApi.register(form);
      onLogin(res.data.token, res.data.user);
    } catch (err) { setError(err.response?.data?.error || "Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-main flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">M</div>
          <h1 className="text-2xl font-bold text-white">MyGPT</h1>
          <p className="text-gray-400 text-sm mt-1">Your personal AI, connected to your apps</p>
        </div>

        <div className="bg-input rounded-2xl p-6 border border-border">
          <div className="flex bg-main rounded-xl p-1 mb-5">
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-accent text-white" : "text-gray-400 hover:text-white"}`}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input name="name" type="text" value={form.name} onChange={handle} placeholder="Name" required
                className="w-full bg-main border border-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent text-sm" />
            )}
            <input name="email" type="email" value={form.email} onChange={handle} placeholder="Email" required
              className="w-full bg-main border border-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent text-sm" />
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="Password" required minLength={6}
              className="w-full bg-main border border-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent text-sm" />
            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent/80 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm">
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
