import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';

// Search + filter bar for the request feeds (issues #81, #82, #85). Owns the
// keyword text locally and debounces it (issue #85) so the feed isn't re-queried
// on every keystroke — only after the user pauses typing does the term flow up
// via onChange. Category and urgency are plain <select>s that report changes
// immediately. The parent holds the committed { search, category, urgency }
// filter state and passes it to getPrioritizedRequests / getAllRequests, which
// forward it to the backend (see docs/FILTER_CONTRACT.md).
//
// @param {{search?: string, category?: string, urgency?: string}} value
//        - the committed filter state (source of truth in the parent)
// @param {(filters) => void} onChange - called with the next filter state
// @param {number} [resultCount] - optional count to show ("N matching")
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Critical', 'High', 'Medium', 'Low'];

const RequestFilterBar = ({ value = {}, onChange, resultCount }) => {
  const { t } = useTranslation();
  const { search = '', category = '', urgency = '' } = value;

  // Local, un-debounced copy of the text field so typing stays responsive.
  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term, 300);

  // When the debounced term settles, push it up — but only if it actually
  // differs from what the parent already has, so we don't loop or re-fetch on
  // an unchanged value.
  useEffect(() => {
    if (debouncedTerm !== search) {
      onChange({ ...value, search: debouncedTerm });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm]);

  // Keep the local field in sync if the parent clears/replaces filters
  // externally (e.g. a "Clear filters" button elsewhere).
  useEffect(() => {
    setTerm(search);
  }, [search]);

  const hasActiveFilter = Boolean(term || category || urgency);

  const clearAll = () => {
    setTerm('');
    onChange({ search: '', category: '', urgency: '' });
  };

  return (
    <div className="bg-[#c3d3ae] dark:bg-[#1f3320] rounded-3xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 transition-colors duration-300">
      {/* Keyword search */}
      <div className="relative flex-1 min-w-[12rem]">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500 dark:text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('requests.filterBar.searchPlaceholder')}
          aria-label={t('requests.filterBar.searchAriaLabel')}
          className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-[#0f1a0f] text-[#1C2A16] dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
        />
      </div>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => onChange({ ...value, category: e.target.value })}
        aria-label={t('requests.filterBar.categoryAriaLabel')}
        className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-[#0f1a0f] text-[#1C2A16] dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
      >
        <option value="">{t('requests.filterBar.allCategories')}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{t(`requests.categories.${c}`)}</option>
        ))}
      </select>

      {/* Urgency filter */}
      <select
        value={urgency}
        onChange={(e) => onChange({ ...value, urgency: e.target.value })}
        aria-label={t('requests.filterBar.urgencyAriaLabel')}
        className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-[#0f1a0f] text-[#1C2A16] dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
      >
        <option value="">{t('requests.filterBar.allUrgencies')}</option>
        {URGENCIES.map((u) => (
          <option key={u} value={u}>{t(`requests.urgencies.${u}`)}</option>
        ))}
      </select>

      {typeof resultCount === 'number' && (
        <span className="text-sm font-semibold text-[#1C2A16] dark:text-gray-200 whitespace-nowrap" role="status">
          {t('requests.filterBar.matching', { count: resultCount })}
        </span>
      )}

      {hasActiveFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="px-3 py-2.5 rounded-xl text-sm font-semibold text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 transition-colors"
        >
          {t('requests.filterBar.clear')}
        </button>
      )}
    </div>
  );
};

export default RequestFilterBar;
