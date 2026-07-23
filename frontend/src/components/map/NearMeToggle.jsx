import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentPosition, DEFAULT_RADIUS_MILES } from '../../utils/geolocation';

// "Near me" geolocation toggle (issue #116). Lets a volunteer or organization
// narrow the request feed to their own area: flipping it on asks the browser
// for the user's location, then reports an active { lat, lng, radiusMiles }
// filter up via onChange (the parent re-fetches the feed with the geo-radius —
// see getPrioritizedRequests). Flipping it off reports null (show everything).
// A small radius picker lets the user widen/narrow the circle without leaving
// the control; changing it re-runs the filter with the same location.
//
// @param {(filter: {lat,lng,radiusMiles}|null) => void} onChange
// @param {boolean} [active] - whether the filter is currently applied
// @param {number|null} [count] - how many requests match, shown when active

const RADIUS_OPTIONS = [10, 25, 50, 100];

const NearMeToggle = ({ onChange, active = false, count = null }) => {
  const { t } = useTranslation();
  // The located point, kept so changing the radius doesn't re-prompt for GPS.
  const [coords, setCoords] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const enable = async () => {
    setLocating(true);
    setError('');
    try {
      const point = coords || (await getCurrentPosition());
      setCoords(point);
      onChange({ ...point, radiusMiles });
    } catch (err) {
      setError(err.message);
      onChange(null);
    } finally {
      setLocating(false);
    }
  };

  const disable = () => {
    setError('');
    onChange(null);
  };

  const toggle = () => (active ? disable() : enable());

  // Widen/narrow without re-prompting: if already on, re-apply with the new
  // radius; otherwise just remember it for when the user turns the filter on.
  const changeRadius = (miles) => {
    setRadiusMiles(miles);
    if (active && coords) {
      onChange({ ...coords, radiusMiles: miles });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={locating}
          aria-pressed={active}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed ${
            active
              ? 'bg-[#6ba3d3] text-white'
              : 'bg-black/5 dark:bg-white/10 text-[#1C2A16] dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/20'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <circle cx="12" cy="11" r="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {locating ? t('requests.nearMe.locating') : active ? t('requests.nearMe.on') : t('requests.nearMe.label')}
        </button>

        {/* Radius picker — always visible so users know the circle is adjustable. */}
        <label className="flex items-center gap-1.5 text-sm text-[#1C2A16] dark:text-gray-300">
          <span className="sr-only">{t('requests.nearMe.searchRadius')}</span>
          <span aria-hidden="true">{t('requests.nearMe.within')}</span>
          <select
            value={radiusMiles}
            onChange={(e) => changeRadius(Number(e.target.value))}
            aria-label={t('requests.nearMe.searchRadiusMiles')}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5 text-sm"
          >
            {RADIUS_OPTIONS.map((m) => (
              <option key={m} value={m}>{t('requests.nearMe.miles', { count: m })}</option>
            ))}
          </select>
        </label>

        {active && count != null && (
          <span className="text-sm text-gray-600 dark:text-gray-400" role="status">
            {t('requests.nearMe.nearby', { count })}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
};

export default NearMeToggle;
