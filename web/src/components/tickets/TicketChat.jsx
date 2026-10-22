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
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => {
          const isSystem = msg.senderType === 'SYSTEM';
          const isCustomer = msg.senderType === 'CUSTOMER';
          const isAgent = msg.senderType === 'AGENT';
          const isMe = isAgent && msg.senderUserId === user?.id;

          // 1. SYSTEM Message
          if (isSystem) {
            return (
              <div key={msg.id || msg.clientMessageId || index} className="flex justify-center my-3">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2 rounded-xl max-w-md text-center shadow-xs">
                  <p className="leading-relaxed">{msg.body}</p>
                  <span className="block text-[10px] text-amber-600/70 mt-1">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          }

          // 2. Customer Message (Left)
          if (isCustomer) {
            return (
              <div key={msg.id || msg.clientMessageId || index} className="flex flex-col items-start max-w-[80%]">
                <span className="text-[11px] font-semibold text-slate-500 mb-1 px-1">
                  {ticket.customer?.name || 'Customer'}
                </span>
                <div className="bg-white border border-slate-200 text-slate-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-xs whitespace-pre-wrap break-words leading-relaxed">
                  {msg.body}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
            );
          }

          // 3. Agent Message (Right)
          const isPending = msg.status === 'pending';
          const isFailed = msg.status === 'failed';

          return (
            <div key={msg.id || msg.clientMessageId || index} className="flex flex-col items-end ml-auto max-w-[80%]">
              <span className="text-[11px] font-semibold text-slate-500 mb-1 px-1">
                {msg.senderUser?.name || (isMe ? 'Saya' : 'Agen')}
              </span>
              <div
                className={`text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-xs whitespace-pre-wrap break-words leading-relaxed ${
                  isFailed
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-brand-600 text-white'
                }`}
              >
                {msg.body}
              </div>

              {/* Status footer for agent messages */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1">
                <span>{formatDateTime(msg.createdAt)}</span>

                {isPending && (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                    <Clock className="w-3 h-3 animate-spin" />
                    Mengirim...
                  </span>
                )}

                {!isPending && !isFailed && (
                  <span className="inline-flex items-center text-slate-400" title="Terkirim">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </span>
                )}

                {isFailed && (
                  <div className="inline-flex items-center gap-1.5 text-rose-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Gagal terkirim</span>
                    <button
                      onClick={() => onDiscardMessage(msg.clientMessageId)}
                      className="text-rose-700 underline font-semibold hover:text-rose-900 ml-1"
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
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        {!canReply ? (
          <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-600 text-xs flex items-center gap-2.5">
            {isClosed ? (
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            ) : isUnassigned ? (
              <UserCheck className="w-4 h-4 text-slate-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>{getDisabledReason()}</span>
          </div>
        ) : (
          <div className="flex items-end gap-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Tulis balasan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all resize-none max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 transition-colors shrink-0 shadow-sm"
              title="Kirim pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
