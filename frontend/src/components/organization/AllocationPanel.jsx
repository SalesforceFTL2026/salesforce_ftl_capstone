import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getRequestAllocations,
  getAllocationSuggestions,
  allocateResource,
  deallocateResource,
  requestErrorMessage,
} from '../../utils/requests';

// Allocation panel for a single request. Lets an org:
//  - see what's already allocated to this request,
//  - get an AI suggestion for what to allocate (type + quantity), and
//  - allocate one of its available resources, or remove an allocation.
//
// Allocating decrements the resource's on-hand count on the backend, so we call
// onChanged after any change to let the dashboard refresh its resource list.
//
// @param {object} request - the selected request ({ id, ... })
// @param {object[]} resources - the org's inventory (for the picker dropdown)
// @param {() => void} onChanged - called after allocate/deallocate succeeds
// @param {boolean} [readOnly] - when true, show what's allocated but hide every
//   control (AI suggest, allocate form, remove) — used for completed requests.
const AllocationPanel = ({ request, resources, onChanged, readOnly = false }) => {
  const { t } = useTranslation();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [resourceId, setResourceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  const requestId = request.id;

  // Resources the org can actually allocate from: available and in stock.
  const availableResources = resources.filter((r) => r.available && r.quantity > 0);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAllocations(await getRequestAllocations(requestId));
    } catch (err) {
      setError(requestErrorMessage(err, t('org.allocation.loadError')));
    } finally {
      setLoading(false);
    }
  }, [requestId, t]);

  // Reset local form state and reload allocations whenever the request changes.
  useEffect(() => {
    setResourceId('');
    setQuantity('');
    setSuggestions([]);
    setSuggestError('');
    loadAllocations();
  }, [loadAllocations]);

  const nameFor = (id) => resources.find((r) => r.id === id)?.name || t('org.allocation.resourceFallback');

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError('');
    try {
      const result = await getAllocationSuggestions(requestId);
      setSuggestions(result);
      if (result.length === 0) {
        setSuggestError(t('org.allocation.noSuggestions'));
      }
    } catch (err) {
      setSuggestError(requestErrorMessage(err, t('org.allocation.suggestError')));
    } finally {
      setSuggesting(false);
    }
  };

  // Apply a suggestion into the form so the org can review before allocating.
  const applySuggestion = (s) => {
    setResourceId(s.resourceId);
    setQuantity(String(s.quantity));
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    setError('');

    if (!resourceId) {
      setError(t('org.allocation.pickResource'));
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError(t('org.allocation.invalidQuantity'));
      return;
    }

    setBusy(true);
    try {
      await allocateResource(requestId, { resourceId, quantity: qty });
      setResourceId('');
      setQuantity('');
      await loadAllocations();
      onChanged?.();
    } catch (err) {
      setError(requestErrorMessage(err, t('org.allocation.allocateError')));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id) => {
    setError('');
    try {
      await deallocateResource(id);
      await loadAllocations();
      onChanged?.();
    } catch (err) {
      setError(requestErrorMessage(err, t('org.allocation.removeError')));
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/40 dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold uppercase tracking-wide text-sm">{t('org.allocation.title')}</h4>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="text-sm font-semibold bg-[#7F9764] text-white px-3 py-1 rounded-full hover:opacity-90 disabled:opacity-60"
          >
            {suggesting ? t('org.allocation.thinking') : t('org.allocation.suggestWithAi')}
          </button>
        )}
      </div>

      {error && <p className="text-red-700 dark:text-red-300 text-sm mb-2">{error}</p>}

      {/* AI suggestions */}
      {!readOnly && suggestError && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{suggestError}</p>
      )}
      {!readOnly && suggestions.length > 0 && (
        <div className="mb-3 space-y-1">
          {suggestions.map((s) => (
            <button
              key={s.resourceId}
              type="button"
              onClick={() => applySuggestion(s)}
              className="w-full text-left text-sm bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1.5 hover:bg-white"
            >
              <span className="font-semibold">
                {s.quantity} × {nameFor(s.resourceId)}
              </span>
              {s.reason ? <span className="text-gray-600 dark:text-gray-400"> — {s.reason}</span> : null}
            </button>
          ))}
        </div>
      )}

      {/* Current allocations */}
      {loading && <p className="text-sm" role="status">{t('org.allocation.loading')}</p>}
      {!loading && allocations.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('org.allocation.nothingAllocated')}</p>
      )}
      {!loading && allocations.length > 0 && (
        <ul className="space-y-1 mb-3">
          {allocations.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-base bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1"
            >
              <span>
                {a.quantity} {a.resource?.unit} · {a.resource?.name}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  className="text-sm font-semibold text-red-600 hover:underline"
                >
                  {t('org.allocation.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Allocate form — hidden for completed (view-only) requests. */}
      {!readOnly && (
      <form onSubmit={handleAllocate} className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:flex-1 sm:w-auto">
          <label htmlFor="alloc-resource" className="text-sm font-semibold uppercase block mb-1">
            {t('org.allocation.resource')}
          </label>
          <select
            id="alloc-resource"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5"
          >
            <option value="">{t('org.allocation.select')}</option>
            {availableResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.quantity} {r.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="w-20 shrink-0">
          <label htmlFor="alloc-qty" className="text-sm font-semibold uppercase block mb-1">
            {t('org.allocation.qty')}
          </label>
          <input
            id="alloc-qty"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 sm:flex-none text-base font-semibold bg-[#1C2A16] dark:bg-[#7F9764] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? t('org.allocation.adding') : t('org.allocation.allocate')}
        </button>
      </form>
      )}
    </div>
  );
};

export default AllocationPanel;
