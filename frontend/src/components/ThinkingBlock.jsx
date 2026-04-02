import { useState } from "react";
import { Search, Plug, ChevronDown, ChevronRight, Check, AlertCircle } from "lucide-react";

function stepIcon(toolName) {
  if (toolName === "__web_search") return <Search size={13} className="shrink-0" />;
  return <Plug size={13} className="shrink-0" />;
}

function WebSearchResults({ result }) {
  if (!result?.results?.length) return <p className="text-muted text-xs mt-1">No results found.</p>;
  return (
    <ol className="mt-2 space-y-2">
      {result.results.map((r, i) => (
        <li key={i} className="text-[12px]">
          <span className="text-muted mr-1.5">{i+1}.</span>
          <span className="text-[#c5c5d2] font-medium">{r.title}</span>
          {r.url && <span className="text-muted ml-2 font-mono text-[11px] truncate">{r.url}</span>}
          {r.snippet && <p className="text-muted mt-0.5 leading-relaxed">{r.snippet}</p>}
        </li>
      ))}
    </ol>
  );
}

function GenericResult({ result }) {
  if (!result) return null;
  if (result.error) return <p className="text-red-400 text-xs mt-1">{result.error}</p>;
  return (
    <pre className="text-[11px] text-muted mt-1 overflow-x-auto whitespace-pre-wrap break-all">
      {JSON.stringify(result, null, 2).slice(0, 500)}
    </pre>
  );
}

function Step({ step }) {
  const [open, setOpen] = useState(false);
  const isSearch = step.toolName === "__web_search";

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/4 transition text-left"
      >
        <span className={step.success ? "text-accent" : "text-red-400"}>
          {step.success ? stepIcon(step.toolName) : <AlertCircle size={13} className="shrink-0"/>}
        </span>
        <span className="text-[13px] text-[#c5c5d2] flex-1 truncate">{step.displayName}</span>
        {step.success && (
          <span className="text-[11px] text-muted shrink-0 mr-1">
            {isSearch && step.result?.count != null ? `${step.result.count} results` : "done"}
          </span>
        )}
        {open ? <ChevronDown size={13} className="text-muted shrink-0"/> : <ChevronRight size={13} className="text-muted shrink-0"/>}
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-white/6">
          {isSearch
            ? <WebSearchResults result={step.result} />
            : <GenericResult result={step.result} />
          }
        </div>
      )}
    </div>
  );
}

export default function ThinkingBlock({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="mb-3 space-y-1.5">
      {steps.map((step, i) => <Step key={i} step={step} />)}
    </div>
  );
}
