import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Patch oneDark background to match our app's dark theme
const theme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: "#1a1a1a",
    margin: 0,
    borderRadius: 0,
    padding: "1rem 1.25rem",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: "transparent",
    fontSize: "13px",
  },
};

export default function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const match    = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code     = String(children).replace(/\n$/, "");

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Inline code (no language, no newlines)
  if (!language && !code.includes("\n")) {
    return (
      <code className="bg-white/10 text-[#e06c75] px-1.5 py-0.5 rounded text-[13px] font-mono">
        {code}
      </code>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-white/8">
        <span className="text-[12px] font-medium text-muted font-mono">
          {language || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[12px] text-muted hover:text-white transition px-2 py-0.5 rounded hover:bg-white/8"
        >
          {copied
            ? <><Check size={12} className="text-accent"/> <span className="text-accent">Copied!</span></>
            : <><Copy size={12}/> <span>Copy</span></>
          }
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language || "text"}
        style={theme}
        showLineNumbers={code.split("\n").length > 4}
        lineNumberStyle={{ color: "#4a4a4a", fontSize: "11px", minWidth: "2.5em" }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
