import { useState, useEffect } from "react";
import { integrationsApi, settingsApi } from "../api/client.js";

// ── Tab: Integrations ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const [list,    setList]    = useState([]);
  const [form,    setForm]    = useState({ name: "", app_url: "", token: "" });
  const [editing, setEditing] = useState(null); // { id, name, app_url }
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try { setList((await integrationsApi.list()).data); }
    catch { setError("Could not load integrations"); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name || !form.app_url || !form.token) { setError("All fields required"); return; }
    setSaving(true); setError("");
    try {
      const res = await integrationsApi.create(form);
      setList(p => [...p, res.data]);
      setForm({ name: "", app_url: "", token: "" });
    } catch (e) { setError(e.response?.data?.error || "Could not add integration"); }
    finally { setSaving(false); }
  }

  async function handleToggle(id, enabled) {
    await integrationsApi.update(id, { enabled: !enabled });
    setList(p => p.map(i => i.id === id ? { ...i, enabled: !enabled } : i));
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this integration?")) return;
    await integrationsApi.delete(id);
    setList(p => p.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-5">
      <p className="text-gray-400 text-sm">
        Add any app that exposes <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs text-accent">GET /api/context</code> with a Bearer token.
        MyGPT will call it before every reply.
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-main rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Add integration</h3>
        <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
          placeholder="Name  (e.g. Sprint Therapy)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent" />
        <input value={form.app_url} onChange={e => setForm(f => ({...f, app_url: e.target.value}))}
          placeholder="Base URL  (e.g. http://206.81.28.139:4000)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent" />
        <input value={form.token} onChange={e => setForm(f => ({...f, token: e.target.value}))}
          placeholder="API Token  (generate it in that app)"
          type="password"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
          {saving ? "Adding…" : "+ Add"}
        </button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">No integrations yet</p>
        )}
        {list.map(i => (
          <div key={i.id} className="flex items-center gap-3 bg-main border border-border rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{i.name}</p>
              <p className="text-xs text-gray-500 truncate font-mono">{i.app_url}</p>
            </div>
            {/* Toggle enabled */}
            <button onClick={() => handleToggle(i.id, i.enabled)}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition shrink-0 ${
                i.enabled
                  ? "bg-accent/20 text-accent hover:bg-accent/30"
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              }`}>
              {i.enabled ? "ON" : "OFF"}
            </button>
            <button onClick={() => handleDelete(i.id)}
              className="text-gray-500 hover:text-red-400 transition shrink-0 text-lg leading-none px-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: AI Settings ──────────────────────────────────────────────────────────

function AISettingsTab() {
  const [keyHint,   setKeyHint]   = useState("");
  const [keySet,    setKeySet]    = useState(false);
  const [newKey,    setNewKey]    = useState("");
  const [model,     setModel]     = useState("gpt-4o");
  const [models,    setModels]    = useState([]);
  const [loadingM,  setLoadingM]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const res = await settingsApi.get();
      setKeySet(res.data.openai_api_key_set);
      setKeyHint(res.data.openai_api_key_hint || "");
      setModel(res.data.openai_model || "gpt-4o");
    } catch {}
    loadModels();
  }

  async function loadModels() {
    setLoadingM(true);
    try {
      const res = await settingsApi.getModels();
      setModels(res.data.models || []);
    } catch { setModels(["gpt-4o","gpt-4o-mini","gpt-4-turbo","gpt-4","gpt-3.5-turbo"]); }
    finally { setLoadingM(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = { openai_model: model };
      if (newKey.trim()) payload.openai_api_key = newKey.trim();
      await settingsApi.save(payload);
      setSaved(true);
      if (newKey.trim()) { setNewKey(""); setKeySet(true); setKeyHint(newKey.slice(0,7)+"…"); }
      // Reload models with new key
      loadModels();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.response?.data?.error || "Could not save"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* OpenAI key */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-white">OpenAI API Key</label>
        {keySet && (
          <p className="text-xs text-gray-500">
            Current key: <code className="text-gray-400">{keyHint}</code>
            <span className="ml-2 text-accent">✓ set</span>
          </p>
        )}
        <input
          type="password"
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder={keySet ? "Paste new key to replace…" : "sk-…"}
          className="w-full bg-input border border-border rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
        />
        <p className="text-xs text-gray-600">
          Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent underline">platform.openai.com/api-keys</a>
        </p>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-white">Model</label>
          <button type="button" onClick={loadModels} disabled={loadingM}
            className="text-xs text-accent hover:underline disabled:opacity-50">
            {loadingM ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="w-full bg-input border border-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent cursor-pointer"
        >
          {models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p className="text-xs text-gray-600">Models are fetched live from OpenAI using your key.</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-3 bg-accent hover:bg-accent/80 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm">
        {saving ? "Saving…" : saved ? "✅ Saved!" : "Save Settings"}
      </button>
    </form>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function SettingsModal({ onClose }) {
  const [tab, setTab] = useState("integrations");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-input rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-white font-bold text-lg">⚙️ Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition text-xl font-bold leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[["integrations","🔌 Integrations"], ["ai","🤖 AI Settings"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                tab === key ? "text-white border-b-2 border-accent" : "text-gray-500 hover:text-gray-300"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "integrations" ? <IntegrationsTab /> : <AISettingsTab />}
        </div>
      </div>
    </div>
  );
}
