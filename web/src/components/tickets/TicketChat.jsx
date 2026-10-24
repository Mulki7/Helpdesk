import { useState, useRef, useEffect } from 'react';
import { formatDateTime } from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Send,
  Clock,
  Check,
  AlertCircle,
  Lock,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export function TicketChat({ ticket, messages, onSendMessage, onDiscardMessage }) {
  const { user, isAdmin } = useAuth();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reply permission logic
  const isAssignee = ticket.assignedAgentId === user?.id;
  const isClosed = ticket.status === 'CLOSED';
  const isUnassigned = !ticket.assignedAgentId;
  const canReply = !isClosed && (isAssignee || isAdmin);

  const getDisabledReason = () => {
    if (isClosed) return 'Percakapan ini telah ditutup. Tidak dapat membalas pesan.';
    if (isUnassigned) return 'Tiket belum diambil. Klik "Ambil Tiket" di atas untuk mulai membalas.';
    if (!canReply)
      return 'Anda bukan assignee tiket ini. Hanya agen yang ditugaskan atau admin yang dapat membalas.';
    return '';
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !canReply) return;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {/* Date separator chip */}
        <div className="flex justify-center my-3">
          <span className="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-semibold shadow-sm">
            Percakapan Berlangsung
          </span>
        </div>

        {messages.map((msg, index) => {
          const isSystem = msg.senderType === 'SYSTEM';
          const isCustomer = msg.senderType === 'CUSTOMER';
          const isAgent = msg.senderType === 'AGENT';
          const isMe = isAgent && msg.senderUserId === user?.id;

          // 1. SYSTEM Message
          if (isSystem) {
            return (
              <div key={msg.id || msg.clientMessageId || index} className="flex justify-center my-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-5 py-2.5 rounded-xl max-w-md text-center shadow-sm">
                  <p className="leading-relaxed font-medium">{msg.body}</p>
                  <span className="block text-xs text-amber-700/70 mt-1.5 font-medium">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          }

          // 2. Customer Message (Left) — Pure White with subtle border
          if (isCustomer) {
            return (
              <div key={msg.id || msg.clientMessageId || index} className="flex flex-col items-start max-w-[70%]">
                <span className="text-xs font-semibold text-slate-500 mb-1.5 px-1">
                  {ticket.customer?.name || 'Customer'}
                </span>
                <div className="bg-white border border-slate-200 text-slate-800 text-sm px-4 py-3 rounded-2xl rounded-tl-sm shadow-md whitespace-pre-wrap break-words leading-relaxed">
                  {msg.body}
                </div>
                <span className="text-xs text-slate-400 mt-1.5 px-1 font-medium">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
            );
          }

          // 3. Agent Message (Right) — Dark Charcoal with White text & Emerald Check
          const isPending = msg.status === 'pending';
          const isFailed = msg.status === 'failed';

          return (
            <div key={msg.id || msg.clientMessageId || index} className="flex flex-col items-end ml-auto max-w-[70%]">
              <span className="text-xs font-semibold text-slate-500 mb-1.5 px-1">
                {msg.senderUser?.name || (isMe ? 'Saya' : 'Agen')}
              </span>
              <div
                className={`text-sm px-4 py-3 rounded-2xl rounded-tr-sm shadow-md whitespace-pre-wrap break-words leading-relaxed ${
                  isFailed
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-[#191c21] text-white'
                }`}
              >
                {msg.body}
              </div>

              {/* Status footer for agent messages */}
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1.5 px-1 font-medium">
                <span>{formatDateTime(msg.createdAt)}</span>

                {isPending && (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Mengirim...
                  </span>
                )}

                {!isPending && !isFailed && (
                  <span className="inline-flex items-center text-emerald-500" title="Terkirim">
                    <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                  </span>
                )}

                {isFailed && (
                  <div className="inline-flex items-center gap-2 text-rose-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Gagal terkirim</span>
                    <button
                      onClick={() => onDiscardMessage(msg.clientMessageId)}
                      className="text-rose-700 underline font-semibold hover:text-rose-900 ml-1 cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar or Disabled State Notice */}
      <div className="px-8 py-5 bg-white border-t border-slate-200/70 shrink-0 shadow-lg">
        {!canReply ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm flex items-center gap-3 shadow-sm">
            {isClosed ? (
              <Lock className="w-5 h-5 text-slate-400 shrink-0" />
            ) : isUnassigned ? (
              <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <span className="leading-relaxed">{getDisabledReason()}</span>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tulis balasan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-3 focus:ring-emerald-500/15 transition-all resize-none max-h-32 shadow-sm focus:shadow-md"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="w-11 h-11 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all shrink-0 shadow-lg shadow-emerald-500/30 flex items-center justify-center cursor-pointer"
              title="Kirim pesan"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

