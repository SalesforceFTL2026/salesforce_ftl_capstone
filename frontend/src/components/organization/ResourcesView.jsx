import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// The baseline resource types an org can stock. Must match the backend's
// allowed list (resourceController RESOURCE_TYPES). More can be added later.
// `labelKey` is the i18n key for the display label; `value` stays literal since
// it's the raw type sent to the backend.
const RESOURCE_TYPES = [
  { value: 'food', labelKey: 'org.resources.types.food', defaultUnit: 'meals' },
  { value: 'wood', labelKey: 'org.resources.types.wood', defaultUnit: 'units' },
  { value: 'health-care-kits', labelKey: 'org.resources.types.healthCareKits', defaultUnit: 'kits' },
];

const typeLabel = (value, t) => {
  const preset = RESOURCE_TYPES.find((rt) => rt.value === value);
  return preset ? t(preset.labelKey) : value;
};

// Organization "Resources" tab. Orgs list the things they have available to
// give out (food, wood, health care kits) and add more. The total count of
// available resources feeds the "Resources Available" pill on the dashboard.
//
// @param {object[]} resources - the org's resources (from GET /api/resources)
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(resource) => Promise} onAdd - add a new resource
// @param {(id, available) => Promise} onToggle - flip availability
// @param {(id) => Promise} onDelete - remove a resource
const ResourcesView = ({
  resources,
  loading,
  error,
  onRetry,
  onAdd,
  onToggle,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [resourceType, setResourceType] = useState(RESOURCE_TYPES[0].value);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(RESOURCE_TYPES[0].defaultUnit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // When the type changes, pre-fill the unit with a sensible default.
  const handleTypeChange = (value) => {
    setResourceType(value);
    const preset = RESOURCE_TYPES.find((t) => t.value === value);
    if (preset) setUnit(preset.defaultUnit);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !quantity || !unit.trim()) {
      setFormError(t('org.resources.formIncomplete'));
      return;
    }

    setSubmitting(true);
    try {
      await onAdd({
        resourceType,
        name: name.trim(),
        quantity: Number(quantity),
        unit: unit.trim(),
      });
      // Reset the free-text fields, keep the selected type for quick entry.
      setName('');
      setQuantity('');
    } catch (err) {
      setFormError(err.message || t('org.resources.addError'));
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] ' +
    'bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white ' +
    'focus:outline-none focus:border-[#7F9764] focus:ring-2 focus:ring-[#7F9764]/30 transition-all';
  const label = 'block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2';

  return (
    <div className="grid lg:grid-cols-[minmax(300px,380px)_1fr] gap-6">
      {/* Add-resource form */}
      <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-6 h-fit">
        <h2 className="text-xl font-bold text-black dark:text-white mb-1">{t('org.resources.addTitle')}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">
          {t('org.resources.addSubtitle')}
        </p>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
            <p className="text-red-800 dark:text-red-300 text-sm">{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="resourceType" className={label}>{t('org.resources.type')}</label>
            <select
              id="resourceType"
              value={resourceType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={field}
            >
              {RESOURCE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="resourceName" className={label}>{t('org.resources.name')}</label>
            <input
              type="text"
              id="resourceName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('org.resources.namePlaceholder')}
              className={field}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="resourceQuantity" className={label}>{t('org.resources.quantity')}</label>
              <input
                type="number"
                id="resourceQuantity"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className={field}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="resourceUnit" className={label}>{t('org.resources.unit')}</label>
              <input
                type="text"
                id="resourceUnit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t('org.resources.unitPlaceholder')}
                className={field}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? t('org.resources.adding') : t('org.resources.addButton')}
          </button>
        </form>
      </div>

      {/* Current inventory */}
      <div className="bg-white dark:bg-[#16233a] rounded-2xl shadow-md p-6">
        <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white mb-4">{t('org.resources.yourResources')}</h2>

        {loading && (
          <p className="text-[#1C2A16] dark:text-gray-300" role="status">{t('org.resources.loading')}</p>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
            <p className="font-semibold">{error}</p>
            <button onClick={onRetry} className="mt-2 text-sm font-semibold underline hover:no-underline">
              {t('org.resources.tryAgain')}
            </button>
          </div>
        )}

        {!loading && !error && resources.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">
            {t('org.resources.emptyState')}
          </p>
        )}

        {!loading && !error && resources.length > 0 && (
          <ul className="flex flex-col gap-3">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-[#2b3b55] p-4"
              >
                <div>
                  <p className="font-semibold text-[#1C2A16] dark:text-white">{r.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {typeLabel(r.resourceType, t)} · {r.quantity} {r.unit}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(r.id, !r.available)}
                    className={`text-xs font-semibold uppercase px-3 py-1.5 rounded-full ${
                      r.available
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {r.available ? t('org.resources.available') : t('org.resources.unavailable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="text-sm font-semibold text-red-600 hover:underline"
                  >
                    {t('org.resources.remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ResourcesView;
