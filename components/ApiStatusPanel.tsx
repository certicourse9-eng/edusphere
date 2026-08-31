'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './ApiStatusPanel.module.css';

interface AccountHealthView {
  status: 'healthy' | 'cooling-down' | 'disabled' | 'unknown';
  cooldownUntil: number | null;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
  requestCount: number;
  successCount: number;
  failureCount: number;
}

interface AccountStatusView {
  accountId: string;
  provider: string;
  providerLabel: string;
  label: string;
  maskedKey: string;
  priority: number;
  disabledByUser: boolean;
  health: AccountHealthView;
}

interface UsageEvent {
  id: string;
  timestamp: number;
  label: string;
  ok: boolean;
  durationMs: number;
  errorType?: string;
  errorMessage?: string;
}

const STATUS_LABEL: Record<AccountHealthView['status'], string> = {
  healthy: 'Healthy',
  'cooling-down': 'Cooling down',
  disabled: 'Disabled',
  unknown: 'Not used yet'
};

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function ApiStatusPanel() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountStatusView[] | null>(null);
  const [recentUsage, setRecentUsage] = useState<UsageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch('/api/ai-status');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Could not load API status');
      setAccounts(data.accounts);
      setRecentUsage(data.recentUsage ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleToggle = async (accountId: string, enabled: boolean) => {
    setBusyId(accountId);
    try {
      const resp = await fetch('/api/ai-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, enabled })
      });
      const data = await resp.json();
      if (resp.ok) setAccounts(data.accounts);
    } finally {
      setBusyId(null);
    }
  };

  const healthyCount = accounts?.filter(a => a.health.status === 'healthy' || a.health.status === 'unknown').length ?? 0;

  return (
    <section className={styles.panel}>
      <button type="button" className={styles.toggle} onClick={() => setOpen(v => !v)}>
        <span>AI provider status</span>
        <span className={styles.status}>
          {accounts ? `${healthyCount}/${accounts.length} available` : 'not checked'} <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.hint}>
            Every configured AI account, tried in this order when grading a paper - if one hits a rate limit, quota
            error, or auth failure, EduSphere automatically falls through to the next one. Accounts are configured via
            environment variables (GROQ_API_KEY, GROQ_API_KEY_2, OPENAI_API_KEY, ...) - add more by setting additional
            keys and redeploying, not through this panel, since keys must never be handled by the browser.
          </p>

          {error && <p className={styles.errorNote}>{error}</p>}

          {accounts && accounts.length === 0 && <p className={styles.emptyNote}>No AI accounts configured.</p>}

          {accounts && accounts.length > 0 && (
            <div className={styles.accountList}>
              {accounts.map(a => (
                <div key={a.accountId} className={styles.accountRow}>
                  <div className={styles.accountHead}>
                    <span className={styles.accountLabel}>
                      {a.providerLabel} · {a.label}
                    </span>
                    <span className={`${styles.statusBadge} ${styles[a.health.status]}`}>{STATUS_LABEL[a.health.status]}</span>
                  </div>
                  <div className={styles.accountMeta}>
                    <span className={styles.keyMask}>{a.maskedKey}</span>
                    <span>
                      {a.health.successCount}/{a.health.requestCount} succeeded
                    </span>
                    <span>Last used {timeAgo(a.health.lastSuccessAt ?? a.health.lastErrorAt)}</span>
                  </div>
                  {a.health.lastError && a.health.status !== 'healthy' && (
                    <p className={styles.lastError} title={a.health.lastError}>
                      {a.health.lastError}
                    </p>
                  )}
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    disabled={busyId === a.accountId}
                    onClick={() => handleToggle(a.accountId, a.disabledByUser)}
                  >
                    {a.disabledByUser ? 'Enable' : 'Disable'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {recentUsage.length > 0 && (
            <>
              <p className={styles.subHint}>Recent requests</p>
              <div className={styles.usageList}>
                {recentUsage.slice(0, 8).map(u => (
                  <div key={u.id} className={styles.usageRow}>
                    <span className={`${styles.usageDot} ${u.ok ? styles.usageOk : styles.usageFail}`} />
                    <span className={styles.usageLabel}>{u.label}</span>
                    <span className={styles.usageTime}>{timeAgo(u.timestamp)}</span>
                    <span className={styles.usageDuration}>{u.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="button" className={styles.refreshBtn} onClick={refresh}>
            Refresh
          </button>
        </div>
      )}
    </section>
  );
}
