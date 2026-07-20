import { useState, useEffect, useCallback } from 'react';
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
const AllocationPanel = ({ request, resources, onChanged }) => {
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
      setError(requestErrorMessage(err, 'Could not load allocations.'));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  // Reset local form state and reload allocations whenever the request changes.
  useEffect(() => {
    setResourceId('');
    setQuantity('');
    setSuggestions([]);
    setSuggestError('');
    loadAllocations();
  }, [loadAllocations]);

  const nameFor = (id) => resources.find((r) => r.id === id)?.name || 'resource';

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError('');
    try {
      const result = await getAllocationSuggestions(requestId);
      setSuggestions(result);
      if (result.length === 0) {
        setSuggestError('No suggestions — add available resources first.');
      }
    } catch (err) {
      setSuggestError(requestErrorMessage(err, 'Could not get a suggestion.'));
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
      setError('Pick a resource to allocate.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Quantity must be a whole number of 1 or more.');
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
      setError(requestErrorMessage(err, 'Could not allocate the resource.'));
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
      setError(requestErrorMessage(err, 'Could not remove the allocation.'));
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/40 dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold uppercase tracking-wide text-xs">Allocated Resources</h4>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="text-xs font-semibold bg-[#7F9764] text-white px-3 py-1 rounded-full hover:opacity-90 disabled:opacity-60"
        >
          {suggesting ? 'Thinking…' : '✨ Suggest with AI'}
        </button>
      </div>

      {error && <p className="text-red-700 dark:text-red-300 text-xs mb-2">{error}</p>}

      {/* AI suggestions */}
      {suggestError && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{suggestError}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mb-3 space-y-1">
          {suggestions.map((s) => (
            <button
              key={s.resourceId}
              type="button"
              onClick={() => applySuggestion(s)}
              className="w-full text-left text-xs bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1.5 hover:bg-white"
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
      {loading && <p className="text-xs" role="status">Loading…</p>}
      {!loading && allocations.length === 0 && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Nothing allocated yet.</p>
      )}
      {!loading && allocations.length > 0 && (
        <ul className="space-y-1 mb-3">
          {allocations.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-sm bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1"
            >
              <span>
                {a.quantity} {a.resource?.unit} · {a.resource?.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(a.id)}
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Allocate form */}
      <form onSubmit={handleAllocate} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="alloc-resource" className="text-xs font-semibold uppercase block mb-1">
            Resource
          </label>
          <select
            id="alloc-resource"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5"
          >
            <option value="">Select…</option>
            {availableResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.quantity} {r.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label htmlFor="alloc-qty" className="text-xs font-semibold uppercase block mb-1">
            Qty
          </label>
          <input
            id="alloc-qty"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="text-sm font-semibold bg-[#1C2A16] dark:bg-[#7F9764] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Allocate'}
        </button>
      </form>
    </div>
  );
};

export default AllocationPanel;
