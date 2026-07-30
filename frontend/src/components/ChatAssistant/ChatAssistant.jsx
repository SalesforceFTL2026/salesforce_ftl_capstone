import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import MappieMascot from './MappieMascot';
import { useModalDismiss } from '../../hooks/useModalDismiss';

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
// @param {string} [greetingKey] - i18n key for the opening greeting, so each
//   portal can offer examples that fit what that role can actually ask about.
//   The backend already tailors the reply prompt by role; this only changes the
//   first line the user sees.
// @param {() => void} [onRequestCreated] - called after a help request is
//   submitted from an in-chat draft card, so the parent can refresh its list.

// Category / urgency options — must match the validation in
// requestController.createRequest so an in-chat submission never bounces.
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

// The assistant often formats replies with markdown (**bold**, ### headings),
// but the chat renders plain text — so those markers would show literally.
// Strip the common ones for a clean read.
const stripMarkdown = (text = '') =>
  text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // "### Title" -> "Title"
    .replace(/\*\*/g, '')               // **bold** markers
    .replace(/__/g, '')                 // __bold__ markers
    .replace(/`/g, '');                 // `code` ticks

// An editable draft the assistant proposed after detecting a new need. The user
// can adjust every field — chips for category/urgency, free text for the rest —
// before submitting to the same POST /api/requests the manual form uses.
const RequestDraftCard = ({ draft, onSubmitted, onDismiss }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(draft.category || 'Other');
  const [urgency, setUrgency] = useState(draft.urgency || 'Medium');
  const [location, setLocation] = useState(draft.location || '');
  const [householdSize, setHouseholdSize] = useState(
    draft.householdSize != null ? String(draft.householdSize) : ''
  );
  const [description, setDescription] = useState(draft.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!location.trim() || !description.trim() || !householdSize) {
      setError(t('chat.draft.required'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/requests', {
        location: location.trim(),
        description: description.trim(),
        householdSize,
        categories: [{ category, urgency }],
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || t('chat.draft.failed'));
    } finally {
      setLoading(false);
    }
  };

  const chip = (active) =>
    `px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
      active
        ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
        : 'bg-white dark:bg-[#1a2f1a] text-gray-700 dark:text-gray-200 border-gray-300 dark:border-[#3a4f30] hover:border-[#1e3a5f]'
    }`;
  const textField =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#273A20] text-gray-900 dark:text-white text-sm focus:outline-none focus:border-[#1e3a5f]';
  const groupLabel = 'text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="w-full rounded-2xl border border-[#1e3a5f]/30 bg-white dark:bg-[#1a2f1a] p-3 space-y-3 text-sm">
      <p className="font-bold text-gray-800 dark:text-gray-100">{t('chat.draft.title')}</p>

      <div>
        <p className={groupLabel}>{t('chat.draft.category')}</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
              {t(`chat.draft.categories.${c.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={groupLabel}>{t('chat.draft.urgency')}</p>
        <div className="flex flex-wrap gap-1.5">
          {URGENCIES.map((u) => (
            <button key={u} type="button" onClick={() => setUrgency(u)} className={chip(urgency === u)}>
              {t(`chat.draft.urgencies.${u.toLowerCase()}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={groupLabel}>{t('chat.draft.location')}</p>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('chat.draft.locationPlaceholder')}
          className={textField}
        />
      </div>

      <div>
        <p className={groupLabel}>{t('chat.draft.household')}</p>
        <input
          type="number"
          min="1"
          step="1"
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value)}
          placeholder={t('chat.draft.householdPlaceholder')}
          className={textField}
        />
      </div>

      <div>
        <p className={groupLabel}>{t('chat.draft.description')}</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={t('chat.draft.descriptionPlaceholder')}
          className={textField}
        />
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-[#1e3a5f] text-white font-semibold hover:bg-[#182f4d] disabled:opacity-50 transition-colors"
        >
          {loading ? t('chat.draft.submitting') : t('chat.draft.submit')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={loading}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#3a4f30] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#273A20] disabled:opacity-50 transition-colors"
        >
          {t('chat.draft.dismiss')}
        </button>
      </div>
    </div>
  );
};

const ChatAssistant = ({
  firstName = 'there',
  open: openProp,
  onOpenChange,
  hideLauncher = false,
  greetingKey = 'chat.greeting',
  onRequestCreated,
}) => {
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
      content: t(greetingKey, { name: firstName }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Let Escape close the chat panel when it's open.
  useModalDismiss(open, () => setOpen(false));

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
      // The assistant reply, plus an editable draft card when the backend
      // detected that this message describes a new help request.
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
        ...(data.draft ? [{ role: 'draft', draft: data.draft }] : []),
      ]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          t('chat.unavailable')
      );
    } finally {
      setLoading(false);
    }
  };

  // A draft card was submitted: replace it with a confirmation bubble and let
  // the parent refresh its request list so the new request shows immediately.
  const handleDraftSubmitted = (index) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === index ? { role: 'assistant', content: t('chat.draft.submitted') } : m
      )
    );
    onRequestCreated?.();
  };

  // The user dismissed a draft without submitting: just drop the card.
  const handleDraftDismissed = (index) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Floating launcher — hidden when the parent supplies its own. Shows the
          Mappie mascot on a soft gradient disc so it reads as "our assistant"
          rather than a generic chat bubble; a small greeting bubble and a gentle
          pulse ring invite a first click. Flips to a close (×) when open. */}
      {!hideLauncher && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? t('chat.closeAssistant') : t('chat.openAssistant')}
          className="group fixed bottom-16 right-6 z-50 flex items-center justify-center focus:outline-none"
        >
          {/* Pulse ring — only while closed, to draw the eye. */}
          {!open && (
            <span className="absolute inline-flex h-16 w-16 rounded-full bg-[#1e3a5f]/30 animate-ping" aria-hidden="true" />
          )}
          <span
            className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl ring-2 ring-white/70 transition-transform duration-200 group-hover:scale-105 group-focus:ring-4 group-focus:ring-[#6ba3d3]/50 ${
              open
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-gradient-to-br from-[#2f5c8f] to-[#1e3a5f]'
            }`}
          >
            {open ? (
              <span className="text-3xl leading-none">×</span>
            ) : (
              <MappieMascot className="w-11 h-11 drop-shadow-sm" />
            )}
          </span>
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
            {messages.map((m, i) =>
              m.role === 'draft' ? (
                <div key={i} className="flex items-start gap-2 justify-start">
                  <MappieMascot className="w-7 h-7 shrink-0 mt-1" />
                  <div className="max-w-[85%] w-full">
                    <RequestDraftCard
                      draft={m.draft}
                      onSubmitted={() => handleDraftSubmitted(i)}
                      onDismiss={() => handleDraftDismissed(i)}
                    />
                  </div>
                </div>
              ) : (
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
                    {m.role === 'assistant' ? stripMarkdown(m.content) : m.content}
                  </div>
                </div>
              )
            )}
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
