import { UserRound } from 'lucide-react';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import { roleLabel } from '../services/identity-api';
import { useI18n } from '../i18n/index.js';

export interface IdentitySwitcherProps {
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onChange: (userId: string) => void;
}

/** Password-less identity switcher: Admin / Writer / Viewer. */
export function IdentitySwitcher({ identity, currentUser, onChange }: IdentitySwitcherProps) {
  const { t } = useI18n();
  if (!identity || !currentUser) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
        <UserRound className="h-3 w-3" aria-hidden="true" />
        {t('identity.loading')}
      </span>
    );
  }

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white py-0.5 pl-1 pr-1.5 text-[11px] text-slate-700"
      title={t('identity.switcherTooltip')}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: currentUser.color }}
        aria-hidden="true"
      >
        {currentUser.initials}
      </span>
      <select
        aria-label={t('identity.switchAria')}
        value={currentUser.id}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[132px] cursor-pointer bg-transparent text-[11px] font-medium outline-none"
      >
        {identity.users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName} · {roleLabel(user.role)}
          </option>
        ))}
      </select>
      <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {roleLabel(currentUser.role)}
      </span>
    </label>
  );
}
