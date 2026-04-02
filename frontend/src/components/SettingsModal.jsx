import { useState, useEffect } from "react";
import { X, Plug, Bot, Trash2, Plus, Eye, EyeOff, RefreshCw, Check } from "lucide-react";
import { integrationsApi, settingsApi } from "../api/client.js";

// ── Integrations tab ──────────────────────────────────────────────────────────

function IntegrationsTab() {
  const [list,    setList]    = useState([]);
  const [form,    setForm]    = useState({ name: "", app_url: "", token: "" });
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
    } catch (e) { setError(e.response?.data?.error || "Could not add"); }
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
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-white mb-1">Connected apps</h3>
        <p className="text-[13px] text-muted leading-relaxed">
          Any app exposing <code className="bg-white/8 text-accent px-1.5 py-0.5 rounded text-[12px] font-mono">GET /api/context</code> with a Bearer token will be used as context before every reply.
        </p>
      </div>

      {/* Existing integrations */}
      {list.length > 0 && (
        <div className="space-y-2">
          {list.map(i => (
            <div key={i.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/8">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center shrink-0">
                <Plug size={15} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-white truncate">{i.name}</p>
                <p className="text-[12px] text-muted truncate font-mono">{i.app_url}</p>
              </div>
              <button
                onClick={() => handleToggle(i.id, i.enabled)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition shrink-0 ${
                  i.enabled ? "bg-accent/20 text-accent" : "bg-white/8 text-muted"
                }`}
              >
                {i.enabled ? "ON" : "OFF"}
              </button>
              <button onClick={() => handleDelete(i.id)}
                className="text-muted hover:text-red-400 transition p-1 rounded shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-3 border-t border-white/8 pt-5">
        <h4 className="text-[13px] font-semibold text-[#c5c5d2]">Add integration</h4>
        <input
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Name  (e.g. Sprint Therapy)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-muted focus:outline-none focus:border-accent/50 transition"
        />
        <input
          value={form.app_url} onChange={e => setForm(f => ({ ...f, app_url: e.target.value }))}
          placeholder="Base URL  (e.g. http://host:4000)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-muted focus:outline-none focus:border-accent/50 transition font-mono"
        />
        <input
          value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
          placeholder="API Token"
          type="password"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-muted focus:outline-none focus:border-accent/50 transition"
        />
        {error && <p className="text-red-400 text-[13px]">{error}</p>}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white text-[14px] font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
          <Plus size={15} />{saving ? "Adding…" : "Add integration"}
        </button>
      </form>
    </div>
  );
}

// ── AI Settings tab ───────────────────────────────────────────────────────────

function AISettingsTab() {
  const [keyHint,  setKeyHint]  = useState("");
  const [keySet,   setKeySet]   = useState(false);
  const [newKey,   setNewKey]   = useState("");
  const [showKey,  setShowKey]  = useState(false);
  const [model,    setModel]    = useState("gpt-5.4-mini");
  const [models,   setModels]   = useState([]);
  const [loadingM, setLoadingM] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const res = await settingsApi.get();
      setKeySet(res.data.openai_api_key_set);
      setKeyHint(res.data.openai_api_key_hint || "");
      setModel(res.data.openai_model || "gpt-5.4-mini");
    } catch {}
    loadModels();
  }

  async function loadModels() {
    setLoadingM(true);
    try {
      const res = await settingsApi.getModels();
      setModels(res.data.models || []);
    } catch { setModels(["gpt-5.4-mini","gpt-4o","gpt-4o-mini","gpt-4-turbo","gpt-3.5-turbo"]); }
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
      loadModels();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.response?.data?.error || "Could not save"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* API Key */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[14px] font-semibold text-white">OpenAI API Key</label>
          {keySet && (
            <span className="text-[12px] text-accent flex items-center gap-1">
              <Check size={12} /> Configured <span className="text-muted font-mono ml-1">{keyHint}</span>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder={keySet ? "Paste new key to replace…" : "sk-…"}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-[14px] text-white placeholder-muted focus:outline-none focus:border-accent/50 transition font-mono"
          />
          <button type="button" onClick={() => setShowKey(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition">
            {showKey ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
        <p className="text-[12px] text-muted">
          Get your key at{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            platform.openai.com/api-keys
          </a>
        </p>
      </div>

      {/* Model */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[14px] font-semibold text-white">Model</label>
          <button type="button" onClick={loadModels} disabled={loadingM}
            className="flex items-center gap-1 text-[12px] text-muted hover:text-white transition disabled:opacity-50">
            <RefreshCw size={12} className={loadingM ? "animate-spin" : ""} />
            {loadingM ? "Loading…" : "Refresh"}
          </button>
        </div>
        <select
          value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-white focus:outline-none focus:border-accent/50 transition cursor-pointer [color-scheme:dark]"
        >
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <p className="text-[12px] text-muted">Models are fetched live from OpenAI using your key.</p>
      </div>

      {error && <p className="text-red-400 text-[13px]">{error}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-2.5 bg-accent hover:bg-accent/80 text-white font-semibold rounded-xl transition disabled:opacity-50 text-[14px]">
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
      </button>
    </form>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "ai",           label: "AI Settings",  icon: Bot  },
];

export default function SettingsModal({ onClose }) {
  const [tab, setTab] = useState("integrations");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full md:max-w-xl bg-[#202123] rounded-t-2xl md:rounded-2xl shadow-2xl border border-white/10 flex flex-col max-h-[92vh] md:max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 md:px-6 py-4 md:py-5 border-b border-white/8 shrink-0">
          <h2 className="text-[16px] md:text-[17px] font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition p-1.5 rounded-lg hover:bg-white/8">
            <X size={18}/>
          </button>
        </div>

        {/* Mobile tabs — top bar */}
        <div className="flex md:hidden border-b border-white/8 shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-medium transition border-b-2 -mb-px ${
                tab === key ? "border-accent text-white" : "border-transparent text-muted"
              }`}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left nav — desktop only */}
          <nav className="hidden md:block w-44 shrink-0 border-r border-white/8 p-2 space-y-0.5">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition text-left ${
                  tab === key
                    ? "bg-white/10 text-white font-medium"
                    : "text-muted hover:bg-white/5 hover:text-[#c5c5d2]"
                }`}
              >
                <Icon size={15} className={tab === key ? "text-accent" : ""} />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 min-w-0">
            {tab === "integrations" ? <IntegrationsTab /> : <AISettingsTab />}
          </div>
        </div>

      </div>
    </div>
  );
}
