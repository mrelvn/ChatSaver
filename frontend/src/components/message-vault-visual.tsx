import { Check, FileText, Sparkles } from "lucide-react";

const MESSAGE_LINES = [
  { id: "MSG-7F2A", label: "QUESTION", text: "How should I structure this idea?" },
  { id: "MSG-91BC", label: "ANSWER", text: "Start with the decision, then preserve context." },
  { id: "MSG-30E8", label: "CODE", text: "const insight = save(message);" },
] as const;

export function MessageVaultVisual() {
  return (
    <aside
      className="message-vault-visual relative mx-auto w-full max-w-[390px]"
      aria-label="Messages becoming a saved, searchable note"
      role="img"
    >
      <div className="message-vault-window">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-ivory/60">
            <span className="message-vault-live size-1.5 rounded-full bg-emerald-400" />
            LIVE CAPTURE
          </div>
          <span className="font-mono text-[9px] text-ivory/35">VAULT / 0042</span>
        </div>

        <div className="relative min-h-[352px] overflow-hidden p-4">
          <div className="message-vault-grid" aria-hidden="true" />
          <div className="message-vault-scan" aria-hidden="true" />

          <div className="relative space-y-2.5">
            {MESSAGE_LINES.map((message, index) => (
              <div
                className={`message-vault-packet message-vault-packet-${index + 1}`}
                key={message.id}
              >
                <div className="flex items-center justify-between font-mono text-[8px] tracking-[0.12em]">
                  <span className="text-crimson-bright">{message.label}</span>
                  <span className="text-ivory/28">{message.id}</span>
                </div>
                <p className={`mt-1.5 text-[11px] leading-4 ${index === 2 ? "font-mono text-amber-200/85" : "text-ivory/72"}`}>
                  {message.text}
                </p>
              </div>
            ))}
          </div>

          <div className="message-vault-route relative my-4 flex items-center gap-2" aria-hidden="true">
            <span>SAVE</span>
            <i />
            <span>INDEX</span>
            <i />
            <span>SYNC</span>
          </div>

          <div className="message-vault-note relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="message-vault-note-icon grid size-8 place-items-center rounded-lg">
                  <FileText className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-ivory">Architecture notes</p>
                  <p className="mt-0.5 font-mono text-[8px] tracking-[0.12em] text-ivory/35">
                    3 BLOCKS · SEARCHABLE
                  </p>
                </div>
              </div>
              <span className="message-vault-check grid size-5 place-items-center rounded-full">
                <Check className="size-3" />
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              <span className="block h-1.5 w-full rounded-full bg-ivory/9" />
              <span className="block h-1.5 w-4/5 rounded-full bg-ivory/7" />
              <span className="block h-1.5 w-3/5 rounded-full bg-primary/25" />
            </div>
          </div>

          <div className="message-vault-status absolute bottom-3 left-4 flex items-center gap-1.5 font-mono text-[8px] tracking-[0.12em] text-emerald-300/70">
            <Sparkles className="size-2.5" />
            MEMORY SAVED
          </div>
        </div>
      </div>
    </aside>
  );
}
