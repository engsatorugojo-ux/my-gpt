import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convsApi, chatApi } from "../api/client.js";
import SettingsModal from "../components/SettingsModal.jsx";

function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5">M</div>
      )}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? "bg-input text-white rounded-tr-sm"
          : "bg-transparent text-gray-100 rounded-tl-sm"
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5">U</div>
      )}
    </div>
  );
}

export default function ChatPage({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen,  setSidebarOpen]    = useState(true);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadConversations() {
    const res = await convsApi.list();
    setConversations(res.data);
  }

  async function loadMessages(id) {
    const res = await convsApi.messages(id);
    setMessages(res.data);
  }

  async function newConversation() {
    const res = await convsApi.create({ title: "New conversation" });
    setConversations(p => [res.data, ...p]);
    setActiveId(res.data.id);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function deleteConversation(id, e) {
    e.stopPropagation();
    await convsApi.delete(id);
    setConversations(p => p.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    let convId = activeId;

    // Auto-create conversation if none selected
    if (!convId) {
      const res = await convsApi.create({ title: "New conversation" });
      convId = res.data.id;
      setConversations(p => [res.data, ...p]);
      setActiveId(convId);
    }

    const userMsg = { role: "user", content: input.trim(), id: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await chatApi.send(convId, userMsg.content);
      setMessages(p => [...p, { role: "assistant", content: res.data.reply, id: Date.now() + 1 }]);
      // Refresh conversation list to update title
      loadConversations();
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Sorry, something went wrong.", id: Date.now() + 1 }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const activeConv = conversations.find(c => c.id === activeId);

  return (
    <div className="flex h-screen bg-main text-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} shrink-0 bg-sidebar flex flex-col transition-all duration-200 overflow-hidden`}>
        {/* Sidebar header */}
        <div className="p-3 border-b border-border">
          <button onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-input transition text-sm font-medium text-gray-300 hover:text-white border border-border">
            <span className="text-lg leading-none">✏️</span> New chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {conversations.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition text-sm ${
                c.id === activeId ? "bg-input text-white" : "text-gray-400 hover:bg-input/60 hover:text-gray-200"
              }`}>
              <span className="flex-1 truncate">💬 {c.title}</span>
              <button onClick={e => deleteConversation(c.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition shrink-0 text-xs px-1">✕</button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4 px-3">No conversations yet</p>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-border space-y-1">
          <button onClick={() => setShowIntegrations(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-input transition text-sm text-gray-400 hover:text-white">
            ⚙️ Settings
          </button>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-500 truncate">{user.name}</span>
            <button onClick={onLogout} className="text-xs text-gray-500 hover:text-white transition">Out</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setSidebarOpen(p => !p)}
            className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-input">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="text-sm text-gray-400 truncate flex-1">{activeConv?.title || "MyGPT"}</span>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm">M</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center mt-20">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">M</div>
                <h2 className="text-2xl font-bold text-white mb-2">How can I help you?</h2>
                <p className="text-gray-400 text-sm">I have access to your Sprint Therapy, Notes and Binance data.</p>
                <p className="text-gray-500 text-xs mt-1">Connect your apps and set your OpenAI key in <button onClick={() => setShowSettings(true)} className="text-accent underline">Settings</button>.</p>
              </div>
            )}
            {messages.map((m, i) => <Message key={m.id || i} role={m.role} content={m.content} />)}
            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">M</div>
                <div className="flex items-center gap-1 px-4 py-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-input border border-border rounded-2xl px-4 py-3 focus-within:border-gray-500 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message MyGPT…"
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none max-h-40 leading-relaxed"
                style={{ height: "auto" }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              />
              <button onClick={sendMessage} disabled={sending || !input.trim()}
                className="w-8 h-8 rounded-lg bg-accent hover:bg-accent/80 flex items-center justify-center transition disabled:opacity-40 shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-2">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
