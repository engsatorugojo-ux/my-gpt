import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PenLine, Search, Trash2, ArrowUp, PanelLeft, Settings2, Copy, Check, Paperclip, X as XIcon } from "lucide-react";
import { convsApi, chatApi } from "../api/client.js";
import SettingsModal from "../components/SettingsModal.jsx";
import CodeBlock from "../components/CodeBlock.jsx";
import ThinkingBlock from "../components/ThinkingBlock.jsx";

// ── Message component ─────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-white p-1 rounded"
      title="Copy"
    >
      {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
    </button>
  );
}

function Message({ role, content, imageUrl, steps }) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2 mb-4 md:mb-6 px-2 md:px-4 group">
        <CopyButton text={content} />
        <div className="max-w-[85%] md:max-w-[70%] space-y-2">
          {imageUrl && (
            <img src={imageUrl} alt="attachment" className="rounded-2xl max-h-64 w-auto ml-auto block border border-white/10" />
          )}
          {content && (
            <div className="bg-input text-[#ececec] rounded-3xl px-5 py-3 text-[15px] leading-7 whitespace-pre-wrap select-text">
              {content}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-4 mb-6 px-4 group">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5">M</div>
      <div className="flex-1 min-w-0">
        <ThinkingBlock steps={steps} />
        <div className="text-[#ececec] text-[15px] pt-0.5 prose-chat select-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: ({ node, className, children, ...props }) =>
              <CodeBlock className={className} {...props}>{children}</CodeBlock>
            }}
          >{content}</ReactMarkdown>
        </div>
        <div className="flex mt-1">
          <CopyButton text={content} />
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-4 mb-6 px-4">
      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">M</div>
      <div className="flex items-center gap-1 pt-2">
        {[0,1,2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-muted animate-bounce inline-block"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}/>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ChatPage({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [image,         setImage]         = useState(null); // {base64, mimeType, previewUrl}
  const [sending,       setSending]       = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [search,        setSearch]        = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); else setMessages([]); }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function loadConversations() {
    try { setConversations((await convsApi.list()).data); } catch {}
  }
  async function loadMessages(id) {
    try { setMessages((await convsApi.messages(id)).data); } catch {}
  }

  async function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    if (window.innerWidth < 768) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function deleteConversation(id, e) {
    e.stopPropagation();
    await convsApi.delete(id);
    setConversations(p => p.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function sendMessage() {
    if (!input.trim() && !image || sending) return;
    const text = input.trim();
    const imgPayload = image ? { imageBase64: image.base64, imageMimeType: image.mimeType } : {};
    const previewUrl = image?.previewUrl;
    let convId = activeId;

    if (!convId) {
      const res = await convsApi.create({ title: (text || "Image").slice(0, 60) });
      convId = res.data.id;
      setConversations(p => [res.data, ...p]);
      setActiveId(convId);
    }

    setMessages(p => [...p, { id: Date.now(), role: "user", content: text, imageUrl: previewUrl }]);
    setInput("");
    setImage(null);
    setSending(true);

    try {
      const res = await chatApi.send(convId, text, imgPayload);
      setMessages(p => [...p, { id: Date.now()+1, role: "assistant", content: res.data.reply, steps: res.data.steps || [] }]);
      loadConversations();
    } catch {
      setMessages(p => [...p, { id: Date.now()+1, role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }

  const filtered = conversations.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase())
  );

  // Group conversations by date
  function groupConversations(list) {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    const week = new Date(today); week.setDate(today.getDate()-7);
    const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
    list.forEach(c => {
      const d = new Date(c.updated_at || c.created_at); d.setHours(0,0,0,0);
      if (d >= today)     groups["Today"].push(c);
      else if (d >= yesterday) groups["Yesterday"].push(c);
      else if (d >= week) groups["Previous 7 days"].push(c);
      else                groups["Older"].push(c);
    });
    return groups;
  }

  const grouped = groupConversations(filtered);

  return (
    <div className="flex h-screen bg-main overflow-hidden relative">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}/>
      )}
      <aside className={`
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-0"}
        fixed md:relative z-30 md:z-auto
        w-[260px] h-full md:h-auto
        ${sidebarOpen ? "md:w-[260px]" : "md:w-0"}
        bg-sidebar flex flex-col
        transition-transform md:transition-[width] duration-200
        overflow-hidden shrink-0
      `}>

        {/* New chat + search */}
        <div className="p-2 pt-3 space-y-0.5">
          <button onClick={newConversation}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] text-[#ececec] hover:bg-white/8 transition group">
            <div className="flex items-center gap-3">
              <PenLine size={15}/>
              <span className="font-medium">New chat</span>
            </div>
          </button>
          <button onClick={() => setSearchOpen(p => !p)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-[#ececec] hover:bg-white/8 transition">
            <Search size={15}/>
            <span>Search</span>
          </button>
          {searchOpen && (
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-white/8 text-sm text-[#ececec] placeholder-muted rounded-xl px-3 py-2 focus:outline-none"
            />
          )}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {Object.entries(grouped).map(([group, convs]) =>
            convs.length === 0 ? null : (
              <div key={group} className="mt-4">
                <p className="px-3 mb-1 text-[11px] font-semibold text-muted uppercase tracking-wider">{group}</p>
                {convs.map(c => (
                  <div key={c.id} onClick={() => { setActiveId(c.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition text-[14px] ${
                      c.id === activeId
                        ? "bg-white/10 text-white"
                        : "text-[#c5c5d2] hover:bg-white/8 hover:text-white"
                    }`}>
                    <span className="truncate flex-1">{c.title}</span>
                    <button onClick={e => deleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition shrink-0 ml-1 p-0.5">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
          {conversations.length === 0 && (
            <p className="text-muted text-[13px] text-center mt-8 px-4">No conversations yet</p>
          )}
        </div>

        {/* Bottom */}
        <div className="p-2 border-t border-white/8">
          <button onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] text-[#ececec] hover:bg-white/8 transition">
            <Settings2 size={15}/>
            <span>Settings</span>
          </button>
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                {user.name[0].toUpperCase()}
              </div>
              <span className="text-[14px] text-[#c5c5d2] truncate max-w-[110px]">{user.name}</span>
            </div>
            <button onClick={onLogout} className="text-[13px] text-muted hover:text-white transition">Out</button>
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <button onClick={() => setSidebarOpen(p => !p)}
            className="text-muted hover:text-white transition p-1.5 rounded-lg hover:bg-white/8">
            <PanelLeft size={18}/>
          </button>
          <span className="text-[15px] font-semibold text-[#ececec] ml-1">MyGPT</span>
        </div>

        {/* Messages or empty state */}
        {messages.length === 0 && !sending ? (
          /* ── Empty state ── */
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32">
            <h1 className="text-[24px] md:text-[32px] font-semibold text-[#ececec] mb-6 md:mb-10 tracking-tight text-center px-4">
              Come posso aiutarti?
            </h1>
            {/* Centered input */}
            <div className="w-full max-w-2xl px-0 md:px-0">
              <InputBox
                inputRef={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e); }}
                onKeyDown={onKeyDown}
                onSend={sendMessage}
                sending={sending}
                image={image}
                onImage={setImage}
                centered
              />
            </div>
          </div>
        ) : (
          /* ── Chat view ── */
          <>
            <div className="flex-1 overflow-y-auto py-4 md:py-6">
              <div className="max-w-3xl mx-auto">
                {messages.map((m, i) => <Message key={m.id || i} role={m.role} content={m.content} imageUrl={m.imageUrl} steps={m.steps}/>)}
                {sending && <TypingIndicator/>}
                <div ref={bottomRef}/>
              </div>
            </div>

            {/* Bottom input */}
            <div className="px-2 md:px-4 pb-3 md:pb-4 shrink-0">
              <div className="max-w-3xl mx-auto">
                <InputBox
                  inputRef={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(e); }}
                  onKeyDown={onKeyDown}
                  onSend={sendMessage}
                  sending={sending}
                  image={image}
                  onImage={setImage}
                />
                <p className="hidden md:block text-center text-[12px] text-muted mt-2">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)}/>}
    </div>
  );
}

// ── Input box (reused in both empty and chat state) ───────────────────────────

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Not an image"));
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg", previewUrl: dataUrl });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function InputBox({ inputRef, value, onChange, onKeyDown, onSend, sending, image, onImage, centered }) {
  const fileRef = useRef(null);

  function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find(i => i.type.startsWith("image/"));
    if (!imgItem) return;
    e.preventDefault();
    fileToImage(imgItem.getAsFile()).then(onImage).catch(() => {});
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onImage(await fileToImage(file)); } catch {}
    e.target.value = "";
  }

  const canSend = (value.trim() || image) && !sending;

  return (
    <div className={`bg-input rounded-[28px] border border-white/8 focus-within:border-white/20 transition ${centered ? "shadow-lg" : ""}`}>
      {image && (
        <div className="px-4 pt-3 pb-1">
          <div className="relative inline-block">
            <img src={image.previewUrl} alt="attachment" className="h-24 w-auto rounded-xl border border-white/10 object-cover" />
            <button
              onClick={() => onImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#3a3a3a] hover:bg-red-500 rounded-full flex items-center justify-center transition"
            >
              <XIcon size={11} />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="text-muted hover:text-white transition shrink-0 mb-0.5 p-1 rounded-lg hover:bg-white/8" title="Attach image">
          <Paperclip size={17}/>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <textarea
          ref={inputRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder="Message MyGPT…"
          rows={1}
          className="flex-1 bg-transparent text-[15px] text-[#ececec] placeholder-muted resize-none focus:outline-none leading-6 max-h-[200px] py-0.5"
        />
        <button onClick={onSend} disabled={!canSend}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition ${
            canSend ? "bg-white text-black hover:bg-gray-200" : "bg-white/15 text-muted cursor-not-allowed"
          }`}>
          <ArrowUp size={15}/>
        </button>
      </div>
    </div>
  );
}
