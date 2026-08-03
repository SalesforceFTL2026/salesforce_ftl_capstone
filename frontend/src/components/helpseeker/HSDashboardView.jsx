// Help-seeker dashboard view. Follows the wireframe — greeting, a profile card,
// an Active Requests list (dated chips with Expand + delete), the primary
// actions, and a right column of nearby participating non-profits — but styled
// to match the landing page: shared design tokens (surface/ink/hairline/forest/
// pin), the Alumni Sans display face on headings, soft card shadows, and the
// coral map-pin accent reserved for the primary CTA and urgent requests.
//
// @param {object} currentUser
// @param {object[]} requests - the user's active requests
// @param {boolean} loading
// @param {string} error
// @param {string|null} deletingId
// @param {(request) => void} onDelete
// @param {() => void} onNewRequest
// @param {() => void} [onVoiceRequest] - open the voice intake flow
// @param {() => void} [onVoiceCall] - open the conversational voice agent
// @param {(fields) => Promise<void>} [onSaveProfile] - persist inline profile edits
// @param {object[]} nonprofits - nearby orgs (real or sample)
// @param {boolean} nonprofitsAreSample
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Urgency ordering for the "Urgency" sort — most urgent first.
const URGENCY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const HSDashboardView = ({
  // onVoiceRequest — Request by Voice temporarily disabled for demo (do not remove)
  currentUser, requests, loading, error, deletingId, onDelete, onNewRequest,
  /* onVoiceRequest, */ onVoiceCall, onSaveProfile, nonprofits, nonprofitsAreSample,
}) => {
  const { t } = useTranslation();
  const firstName = currentUser?.name?.split(' ')[0] || 'Name';

  // Filter + sort controls for the Active Requests list. Default sort is by
  // request date (newest first) so the most recent submission is on top.
  const [reqFilters, setReqFilters] = useState({ category: '', urgency: '', sort: 'newest' });
  const visibleRequests = useMemo(() => {
    const list = requests.filter((r) => {
      if (reqFilters.category && r.category !== reqFilters.category) return false;
      if (reqFilters.urgency && r.urgency !== reqFilters.urgency) return false;
      return true;
    });
    // Copy before sorting so we never mutate the prop array in place.
    return [...list].sort((a, b) => {
      if (reqFilters.sort === 'priority') return (b.priorityScore || 0) - (a.priorityScore || 0);
      if (reqFilters.sort === 'urgency') return (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9);
      if (reqFilters.sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); // newest (default)
    });
  }, [requests, reqFilters]);

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(300px,380px)] gap-6">
      {/* ---- Left column: greeting, profile, requests, actions ---- */}
      <div className="bg-surface-2 dark:bg-surface-2 rounded-3xl p-6 sm:p-8 ring-1 ring-hairline shadow-card transition-colors duration-300">
        <h2 className="font-display text-3xl sm:text-5xl text-ink tracking-wide leading-none break-words">
          {t('dashboardView.greeting', { name: firstName })}
        </h2>

        {/* Profile card — deep forest, one accent (the coral Edit action). */}
        <ProfileCard currentUser={currentUser} onSaveProfile={onSaveProfile} t={t} />

        {/* Active requests header + count pill. The pill reflects the filtered
            count; the controls beside it filter by category/urgency and sort. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-2xl text-ink tracking-wide">
              {t('dashboardView.activeRequests')}
            </h3>
            {!loading && !error && requests.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-forest-100 dark:bg-surface-3 text-forest-700 dark:text-forest-300 text-sm font-bold uppercase tracking-wide">
                {t('dashboardView.activeCount', { count: visibleRequests.length })}
              </span>
            )}
          </div>
          {!loading && !error && requests.length > 0 && (
            <RequestControls filters={reqFilters} onChange={setReqFilters} t={t} />
          )}
        </div>

        {/* Fixed-height area (~4 rows tall) so the section never grows or
            shrinks with the request count — every state lives inside the same
            22rem box and scrolls internally; pr-1 keeps the scrollbar off the
            delete buttons. */}
        <div className="h-[22rem] overflow-y-auto pr-1">
          {loading && (
            <p className="text-ink-muted" role="status">{t('dashboardView.loadingRequests')}</p>
          )}
          {!loading && error && <p className="text-pin-600 dark:text-pin-400">{error}</p>}
          {!loading && !error && requests.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline p-6 text-center">
              <p className="text-ink font-semibold">{t('dashboardView.noActiveRequests')}</p>
              <p className="text-ink-muted text-base mt-1">{t('dashboardView.noActiveRequestsHint')}</p>
            </div>
          )}
          {/* Has requests, but the active filters hide them all. */}
          {!loading && !error && requests.length > 0 && visibleRequests.length === 0 && (
            <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-hairline p-6 text-center">
              <p className="text-ink-muted">{t('dashboardView.noMatchingRequests')}</p>
            </div>
          )}

          {!loading && !error && visibleRequests.length > 0 && (
            <ul className="flex flex-col gap-3">
              {visibleRequests.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  deleting={deletingId === r.id}
                  onDelete={onDelete}
                  t={t}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Primary actions. The coral CTA is the one bold accent; the secondary
            actions are quiet outlined buttons so the hierarchy is clear. */}
        <div className="flex flex-col sm:flex-row flex-wrap justify-center items-stretch gap-3 mt-8">
          <button
            type="button"
            onClick={onNewRequest}
            className="px-8 py-4 bg-pin-500 text-white font-bold rounded-full text-lg hover:bg-pin-600 focus:outline-none focus:ring-2 focus:ring-pin-500/40 transition-colors shadow-card"
          >
            {t('dashboardView.makeNewRequest')}
          </button>
          {/* Talk to Us — conversational voice agent (browser speech in/out). */}
          {onVoiceCall && (
            <SecondaryAction onClick={onVoiceCall} label={t('dashboardView.talkToUs')}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21m-3 0h6" />
            </SecondaryAction>
          )}

          {/* Request by Voice — temporarily disabled for demo (do not remove)
          {onVoiceRequest && (
            <SecondaryAction onClick={onVoiceRequest} label={t('dashboardView.requestByVoice')}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21m-3 0h6" />
            </SecondaryAction>
          )}
          */}
        </div>
      </div>

      {/* ---- Right column: participating non-profits ---- */}
      {/* Flex column so the org list fills the whole card. The grid stretches
          this card to match the left column's height, and the list below flexes
          to fill whatever space is left under the title. */}
      <div className="bg-forest-800 dark:bg-surface-2 rounded-3xl p-6 ring-1 ring-hairline shadow-card transition-colors duration-300 flex flex-col">
        <h2 className="font-display text-2xl sm:text-3xl text-white dark:text-forest-300 text-center mb-6 leading-tight tracking-wide">
          {t('dashboardView.nonprofitsTitle')}
        </h2>
        {/* Scroll area fills the remaining card height (flex-1 + min-h-0 so it
            can shrink and scroll). Each row is a fixed 6rem (h-24) so 2- and
            3-line cards tile uniformly. Scroll-snap keeps rows aligned to the
            top as you scroll so a row is never left half-cut at the edge. */}
        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 snap-y snap-mandatory">
          {nonprofits.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <p className="text-white/70 dark:text-ink-muted">{t('dashboardView.noOrgs')}</p>
            </div>
          ) : (
            nonprofits.map((org) => {
              // Real orgs carry resourceTypes[]/location; sample orgs carry
              // type/distance. Show whichever the record has.
              const primaryLine =
                org.type || (org.resourceTypes?.length ? org.resourceTypes.join(', ') : t('dashboardView.orgNoTypes'));
              const secondaryLine = org.distance || org.location;
              return (
                <div key={org.id} className="flex items-stretch gap-3 h-24 snap-start">
                  <OrgLogo org={org} t={t} />
                  <div className="flex-1 flex flex-col justify-center bg-white/95 dark:bg-surface-3 rounded-xl p-3 text-forest-900 dark:text-ink text-base min-w-0">
                    <p className="font-bold truncate">{org.organizationName || org.name}</p>
                    <p className="truncate">{primaryLine}</p>
                    {secondaryLine && (
                      <p className="text-forest-600 dark:text-ink-muted truncate">{secondaryLine}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {nonprofitsAreSample && (
          <p className="text-white/70 dark:text-ink-muted text-sm text-center mt-4 italic">
            {t('dashboardView.sampleOrgsNote')}
          </p>
        )}
      </div>
    </div>
  );
};

// An organization's logo tile. Shows the hosted logo when it loads; if there's
// no URL or the image fails to load (e.g. the domain has no logo), it falls
// back to the org's initials so the panel never shows a broken image. Uses
// object-contain + padding so wide wordmark logos aren't cropped.
const OrgLogo = ({ org, t }) => {
  const [failed, setFailed] = useState(false);
  const displayName = org.organizationName || org.name || '';
  const showImage = org.logoUrl && !failed;

  if (showImage) {
    return (
      <img
        src={org.logoUrl}
        alt={displayName || t('dashboardView.organizationLogo')}
        onError={() => setFailed(true)}
        className="w-20 h-20 shrink-0 rounded-xl object-contain bg-white p-2"
      />
    );
  }

  return (
    <div className="w-20 h-20 shrink-0 rounded-xl bg-white/90 flex items-center justify-center text-forest-700 font-display text-2xl font-bold uppercase">
      {displayName ? displayName.charAt(0) : t('dashboardView.organizationLogo')}
    </div>
  );
};

// A quiet, outlined secondary action button. Children are the <path> elements
// for the leading icon so each caller supplies its own glyph.
const SecondaryAction = ({ onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-8 py-4 bg-transparent text-ink font-bold rounded-full text-lg ring-1 ring-hairline hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-forest-400/50 transition-colors inline-flex items-center justify-center gap-2"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {children}
    </svg>
    {label}
  </button>
);

// Urgency badge — coral for the two urgent levels (the brand's one accent),
// quiet neutral for the rest. Falls back to nothing when urgency is unknown.
const UrgencyBadge = ({ urgency, t }) => {
  if (!urgency) return null;
  const urgent = urgency === 'Critical' || urgency === 'High';
  const cls = urgent
    ? 'bg-pin-500 text-white'
    : 'bg-forest-100 text-forest-700 dark:bg-surface-3 dark:text-forest-300';
  const label = t(`requests.urgencies.${urgency}`, { defaultValue: urgency });
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
};

// Status pill — a neutral chip on the forest card so the request's current
// stage (pending, assigned, in-progress, matched…) is visible at a glance
// without expanding. Falls back to "pending" when status is unset.
const StatusBadge = ({ status, t }) => {
  const value = status || 'pending';
  const label = t(`requests.statusOptions.${value}`, { defaultValue: value });
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-white/15 text-forest-100 capitalize">
      {label}
    </span>
  );
};

// Compact filter + sort controls for the Active Requests list. Category and
// urgency reuse the shared filterBar/category/urgency i18n keys; the sort keys
// live under dashboardView. Styled with app tokens and the coral focus ring so
// it matches the rest of the dashboard.
const REQ_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const REQ_URGENCIES = ['Critical', 'High', 'Medium', 'Low'];
const REQ_SORTS = ['newest', 'oldest', 'priority', 'urgency'];
const RequestControls = ({ filters, onChange, t }) => {
  const selectClass =
    'px-3 py-1.5 rounded-full bg-surface-3 text-ink text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pin-500/40 transition-colors';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={filters.category}
        aria-label={t('requests.filterBar.categoryAriaLabel')}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
      >
        <option value="">{t('requests.filterBar.allCategories')}</option>
        {REQ_CATEGORIES.map((c) => (
          <option key={c} value={c}>{t(`requests.categories.${c}`)}</option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.urgency}
        aria-label={t('requests.filterBar.urgencyAriaLabel')}
        onChange={(e) => onChange({ ...filters, urgency: e.target.value })}
      >
        <option value="">{t('requests.filterBar.allUrgencies')}</option>
        {REQ_URGENCIES.map((u) => (
          <option key={u} value={u}>{t(`requests.urgencies.${u}`)}</option>
        ))}
      </select>
      <select
        className={selectClass}
        value={filters.sort}
        aria-label={t('dashboardView.sortAriaLabel')}
        onChange={(e) => onChange({ ...filters, sort: e.target.value })}
      >
        {REQ_SORTS.map((s) => (
          <option key={s} value={s}>{t(`dashboardView.sort.${s}`)}</option>
        ))}
      </select>
    </div>
  );
};

// One request: a dated chip that expands in place to reveal the details and the
// AI priority score + reasoning (Crisis360's core value), plus a delete button.
const RequestRow = ({ request, deleting, onDelete, t }) => {
  const [expanded, setExpanded] = useState(false);

  const d = request.createdAt ? new Date(request.createdAt) : null;
  const day = d ? d.getDate() : '—';
  const month = d ? d.toLocaleString(undefined, { month: 'short' }) : '';
  const typeLabel = request.category
    ? `${t(`requests.categories.${request.category}`, { defaultValue: request.category })} ${t('dashboardView.requestSuffix')}`
    : t('dashboardView.requestSuffix');
  const hasScore = typeof request.priorityScore === 'number' && request.priorityScore > 0;

  return (
    <li>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-4 bg-forest-800 dark:bg-surface-3 rounded-2xl px-4 py-3 text-white min-w-0">
          <div className="w-14 h-14 rounded-xl bg-forest-100 text-forest-900 flex flex-col items-center justify-center leading-none shrink-0">
            <span className="text-lg font-bold">{day}</span>
            <span className="text-xs font-semibold uppercase">{month}</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-display text-lg tracking-wide truncate block">{typeLabel}</span>
            <div className="flex items-center flex-wrap gap-2 mt-0.5">
              <UrgencyBadge urgency={request.urgency} t={t} />
              <StatusBadge status={request.status} t={t} />
              {hasScore && (
                <span className="text-forest-100 text-sm font-semibold">
                  {t('dashboardView.detailPriority')} {Math.round(request.priorityScore)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t('dashboardView.collapseRequest') : t('dashboardView.expandRequest')}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-base font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            {expanded ? t('dashboardView.collapse') : t('dashboardView.expand')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDelete(request)}
          disabled={deleting}
          aria-label={t('dashboardView.deleteRequest')}
          className="w-10 h-10 shrink-0 flex items-center justify-center text-ink-muted hover:text-pin-600 disabled:opacity-50 transition-colors"
        >
          {deleting ? (
            <span className="text-sm">…</span>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Expanded details — real fields only; never invents data. */}
      {expanded && (
        <div className="mt-2 mr-12 rounded-2xl bg-surface ring-1 ring-hairline p-4 text-base">
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Detail label={t('dashboardView.detailStatus')} value={request.status && t(`requests.statusOptions.${request.status}`, { defaultValue: request.status })} />
            <Detail label={t('dashboardView.detailUrgency')} value={request.urgency && t(`requests.urgencies.${request.urgency}`, { defaultValue: request.urgency })} />
            <Detail label={t('dashboardView.detailLocation')} value={request.location} />
            {hasScore && (
              <Detail label={t('dashboardView.detailPriority')} value={`${Math.round(request.priorityScore)} / 100`} />
            )}
          </dl>
          <div className="mt-3">
            <p className="font-bold uppercase text-xs tracking-wide text-ink-muted mb-1">
              {t('dashboardView.detailDescription')}
            </p>
            <p className="text-ink">{request.description || t('dashboardView.noDescription')}</p>
          </div>
          {request.reasoning && (
            <div className="mt-3 rounded-xl bg-surface-3 p-3">
              <p className="font-bold uppercase text-xs tracking-wide text-forest-700 dark:text-forest-300 mb-1">
                {t('dashboardView.whyPrioritized')}
              </p>
              <p className="text-ink">{request.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

// One label/value pair in the expanded details grid. Renders nothing when the
// value is empty so the grid never shows blank rows.
const Detail = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="font-bold uppercase text-xs tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-ink capitalize truncate">{value}</dd>
    </div>
  );
};

// The forest profile card. Reads as a summary until Edit is pressed, then the
// three fields become inputs edited in place and saved via onSaveProfile —
// no navigating away to Settings. Cancel restores the last saved values.
const ProfileCard = ({ currentUser, onSaveProfile, t }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Draft values, seeded from the current user each time editing opens.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [household, setHousehold] = useState('');

  const startEditing = () => {
    setName(currentUser?.name || '');
    setPhone(currentUser?.phoneNumber || '');
    setHousehold(currentUser?.householdSize != null ? String(currentUser.householdSize) : '');
    setError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setError('');
    setEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSaveProfile({ name, phoneNumber: phone, householdSize: household });
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('dashboardView.editSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-forest-800 dark:bg-surface-3 rounded-2xl p-5 text-white mt-6">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <span className="font-display text-sm tracking-wider uppercase text-forest-100">
            {t('dashboardView.profile')}
          </span>
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={t('dashboardView.profile')}
              className="w-16 h-16 rounded-full object-cover bg-white/90"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center text-forest-900 text-2xl font-bold">
              {(currentUser?.name?.[0] || '?').toUpperCase()}
            </div>
          )}
        </div>

        <div className="w-full sm:flex-1 space-y-2 text-base min-w-0">
          <ProfileField
            label={t('dashboardView.name')}
            value={currentUser?.name}
            placeholder={t('common.notSetYet')}
            editing={editing}
            inputProps={{
              type: 'text',
              value: name,
              onChange: (e) => setName(e.target.value),
              placeholder: t('dashboardView.name'),
              'aria-label': t('dashboardView.name'),
            }}
          />
          <ProfileField
            label={t('dashboardView.phoneNumber')}
            value={currentUser?.phoneNumber}
            placeholder={t('common.notSetYet')}
            editing={editing}
            inputProps={{
              type: 'tel',
              value: phone,
              onChange: (e) => setPhone(e.target.value),
              placeholder: t('dashboardView.phoneNumber'),
              'aria-label': t('dashboardView.phoneNumber'),
            }}
          />
          <ProfileField
            label={t('dashboardView.householdCount')}
            value={currentUser?.householdSize != null ? String(currentUser.householdSize) : ''}
            placeholder={t('common.notSetYet')}
            editing={editing}
            inputProps={{
              type: 'number',
              min: '1',
              max: '100',
              value: household,
              onChange: (e) => setHousehold(e.target.value),
              placeholder: t('dashboardView.householdCount'),
              'aria-label': t('dashboardView.householdCount'),
            }}
          />
          {error && <p className="text-pin-200 text-sm pt-1">{error}</p>}
        </div>

        {onSaveProfile && (
          <div className="shrink-0 w-full sm:w-auto self-stretch sm:self-start flex flex-col gap-2">
            {editing ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-full bg-pin-500 text-white text-base font-bold hover:bg-pin-600 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50 transition-colors"
                >
                  {saving ? t('dashboardView.editSaving') : t('dashboardView.editSave')}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-full bg-white/15 text-white text-base font-bold hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50 transition-colors"
                >
                  {t('dashboardView.editCancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="px-4 py-1.5 rounded-full bg-forest-100 text-forest-900 text-base font-bold hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
              >
                {t('dashboardView.editProfile')}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

// One profile row. In read mode it shows the saved value (or a muted
// placeholder); in edit mode it swaps in an input styled to sit on the forest
// card. `inputProps` are spread onto the <input> so each field sets its own type.
const ProfileField = ({ label, value, placeholder, editing, inputProps }) => (
  <div className="flex items-center gap-3">
    <span className="font-bold uppercase text-sm w-28 shrink-0 text-forest-100">{label}</span>
    {editing ? (
      <input
        {...inputProps}
        className="flex-1 min-w-0 bg-white/20 rounded px-2 py-1 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/60"
      />
    ) : value ? (
      <span className="flex-1 bg-white/20 rounded px-2 py-1 truncate">{value}</span>
    ) : (
      <span className="flex-1 bg-white/20 rounded px-2 py-1 text-white/60 italic">{placeholder}</span>
    )}
  </div>
);

export default HSDashboardView;
