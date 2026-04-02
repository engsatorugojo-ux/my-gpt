import { useState, useEffect } from "react";
import { integrationsApi } from "../api/client.js";

const APPS = [
  { name: "sprint-manager", label: "Sprint Therapy",  emoji: "⚡", placeholder: "http://206.81.28.139:4000" },
  { name: "note-app",       label: "Note App",         emoji: "📝", placeholder: "http://206.81.28.139:4001" },
  { name: "binance-bots",   label: "Binance Bots",     emoji: "📈", placeholder: "http://206.81.28.139:3001" },
];

export default function IntegrationsModal({ onClose }) {
  const [integrations, setIntegrations] = useState({});
  const [forms, setForms]   = useState({});
  const [saving, setSaving] = useState({});
  const [saved,  setSaved]  = useState({});

  useEffect(() => {
    integrationsApi.list().then(res => {
      const map = {};
      res.data.forEach(i => { map[i.app_name] = i; });
      setIntegrations(map);
      const f = {};
      APPS.forEach(a => {
        f[a.name] = { app_url: map[a.name]?.app_url || "", token: "", enabled: map[a.name]?.enabled ?? true };
      });
      setForms(f);
    });
  }, []);

  function setField(app, key, val) {
    setForms(p => ({ ...p, [app]: { ...p[app], [key]: val } }));
  }

  async function handleSave(appName) {
    const f = forms[appName];
    if (!f.app_url || !f.token) return;
    setSaving(p => ({ ...p, [appName]: true }));
    try {
      await integrationsApi.save(appName, f);
      setSaved(p => ({ ...p, [appName]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [appName]: false })), 2000);
      setField(appName, "token", ""); // clear token field after save
    } finally { setSaving(p => ({ ...p, [appName]: false })); }
  }

  async function handleRemove(appName) {
    if (!window.confirm("Remove this integration?")) return;
    await integrationsApi.delete(appName);
    setIntegrations(p => { const n = { ...p }; delete n[appName]; return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-input rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">🔌 Integrations</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition text-xl font-bold leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-gray-400 text-sm">Connect your apps so MyGPT can read your data as context.</p>

          {APPS.map(app => {
            const connected = !!integrations[app.name];
            const f = forms[app.name] || { app_url: "", token: "", enabled: true };
            return (
              <div key={app.name} className="bg-main rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{app.emoji}</span>
                    <span className="font-semibold text-white">{app.label}</span>
                    {connected && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">Connected</span>}
                  </div>
                  {connected && (
                    <button onClick={() => handleRemove(app.name)} className="text-xs text-red-400 hover:text-red-300 transition">Remove</button>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    value={f.app_url}
                    onChange={e => setField(app.name, "app_url", e.target.value)}
                    placeholder={`API URL — e.g. ${app.placeholder}`}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                  <input
                    value={f.token}
                    onChange={e => setField(app.name, "token", e.target.value)}
                    placeholder={connected ? "Paste new API token to update…" : "Paste API token from that app"}
                    type="password"
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  onClick={() => handleSave(app.name)}
                  disabled={saving[app.name] || !f.app_url || !f.token}
                  className="w-full py-2 text-sm font-semibold rounded-lg transition disabled:opacity-40 bg-accent hover:bg-accent/80 text-white"
                >
                  {saving[app.name] ? "Saving…" : saved[app.name] ? "✅ Saved!" : connected ? "Update" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
