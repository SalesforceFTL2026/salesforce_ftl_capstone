import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import MappieMascot from './MappieMascot';

// AI chat assistant for the help-seeker dashboard. Opening it reveals a chat
// panel anchored to the bottom-right. Messages are sent to POST /api/chat,
// which grounds replies in the help-seeker's own profile and requests.
// Conversation history is kept in component state and sent with each message
// so the assistant stays in context.
//
// Open state can be controlled by the parent (pass `open` + `onOpenChange`) so
// an inline button elsewhere on the page can toggle the chat. If those aren't
// passed, the component manages its own open state.
//
// @param {string} [firstName] - used only for the friendly opening greeting
// @param {boolean} [open] - controlled open state (optional)
// @param {(open: boolean) => void} [onOpenChange] - controlled setter (optional)
// @param {boolean} [hideLauncher] - hide the built-in floating round button,
//   e.g. when the parent renders its own trigger button
const ChatAssistant = ({ firstName = 'there', open: openProp, onOpenChange, hideLauncher = false }) => {
  const { t } = useTranslation();
  const [openState, setOpenState] = useState(false);
  // Use the controlled value when provided, otherwise fall back to local state.
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = (next) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(value);
    if (openProp === undefined) setOpenState(value);
  };
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t('chat.greeting', { name: firstName }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep the message list scrolled to the newest message.
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    setInput('');

    // Show the user's message right away, and remember the history to send.
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      // Send prior turns (minus the seeded greeting) so the reply stays in context.
      const history = nextMessages
        .slice(1, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data } = await api.post('/api/chat', { message: text, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          t('chat.unavailable')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher button — hidden when the parent supplies its own. */}
      {!hideLauncher && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? t('chat.closeAssistant') : t('chat.openAssistant')}
          className="fixed bottom-16 right-6 z-50 w-16 h-16 rounded-full bg-[#1e3a5f] text-white shadow-xl flex items-center justify-center hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/50 transition-colors"
        >
          {open ? (
            <span className="text-2xl leading-none">×</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-8 8 8.5 8.5 0 01-3.5-.75L3 21l1.5-4A8 8 0 1121 12z" />
            </svg>
          )}
        </button>
      )}

      {/* Chat panel — opens as a centered modal with a dim backdrop, matching
          the "Make New Request" modal so it reads as intentional rather than
          floating over the page content. Clicking the backdrop closes it. */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
        <div
          className="w-full max-w-md h-[32rem] max-h-[calc(100vh-3rem)] flex flex-col bg-white dark:bg-[#273A20] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3a4f30] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#1e3a5f] text-white shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <MappieMascot className="w-9 h-9" />
              </div>
              <div>
                <p className="font-bold leading-tight">Mappie</p>
                <p className="text-xs text-white/70">{t('chat.assistantSubtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('chat.closeAssistant')}
              className="text-white/80 hover:text-white text-2xl leading-none -mt-1 focus:outline-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <MappieMascot className="w-7 h-7 shrink-0 mb-0.5" />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#1e3a5f] text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-[#1a2f1a] text-gray-800 dark:text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-2 justify-start">
                <MappieMascot className="w-7 h-7 shrink-0 mb-0.5" />
                <div className="bg-gray-100 dark:bg-[#1a2f1a] text-gray-500 dark:text-gray-400 rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  {t('chat.thinking')}
                </div>
              </div>
            )}
            {error && (
              <p className="text-red-600 dark:text-red-400 text-xs text-center">{error}</p>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-gray-200 dark:border-[#3a4f30] flex gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white font-semibold text-sm hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('chat.send')}
            </button>
          </form>
        </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
