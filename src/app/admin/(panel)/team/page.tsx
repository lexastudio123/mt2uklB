import { db } from '@/lib/db';
import { requireArea, ROLE_LABEL } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { ago, fd } from '@/lib/admin/format';
import { Flash, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { addAdminAction, changeRoleAction, resetAdminPasswordAction, resetTwoStepAction, toggleAdminAction } from './actions';

export const metadata = { title: 'Team' };

export default async function TeamPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireArea('team');
  const sp = await searchParams;
  const team = await db.adminUser.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
  return (
    <>
      <PageHead title="Team" sub="Who can sign in to the admin. Owners manage the team; admins run everything else; staff handle orders, customers and the inbox." />
      <Flash sp={sp} />
      <div className="a-split">
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Last sign in</th>
                <th>Status</th>
                <th>
                  <span className="a-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b style={{ fontWeight: 600 }}>
                      {u.name}
                      {u.id === me.id ? ' (you)' : ''}
                    </b>
                    <span className="a-small">
                      {u.email} · added {fd(u.createdAt)}
                    </span>
                  </td>
                  <td>
                    <form action={changeRoleAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.name}`} className="a-input" style={{ minHeight: 32, width: 'auto', padding: '4px 8px' }}>
                        <option value="owner">{ROLE_LABEL.owner}</option>
                        <option value="admin">{ROLE_LABEL.admin}</option>
                        <option value="staff">{ROLE_LABEL.staff}</option>
                      </select>
                      <SubmitButton className="a-btn ghost sm">Set</SubmitButton>
                    </form>
                  </td>
                  <td className="a-small" style={{ color: 'var(--ink)' }}>
                    {u.lastLoginAt ? ago(u.lastLoginAt) : 'Never'}
                  </td>
                  <td>
                    {!u.active ? <Pill>Deactivated</Pill> : u.passwordHash ? <Pill tone="green">Active</Pill> : <Pill tone="amber">Setup link not used yet</Pill>}{' '}
                    {u.totpEnabledAt ? <Pill tone="teal">Two-step on</Pill> : u.passwordHash ? <Pill>Password only</Pill> : null}
                  </td>
                  <td className="a-right">
                    {u.id !== me.id && u.totpEnabledAt && (
                      <form action={resetTwoStepAction} style={{ marginBottom: 6 }}>
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitButton className="a-btn ghost sm" confirm={`Reset two-step sign in for ${u.name}? Use this if they lost their phone.`}>
                          Reset two-step
                        </SubmitButton>
                      </form>
                    )}
                    {u.id !== me.id && (
                      <form action={toggleAdminAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <SubmitButton className={u.active ? 'a-btn danger sm' : 'a-btn ghost sm'} confirm={u.active ? `Deactivate ${u.name}? They are signed out straight away.` : `Let ${u.name} sign in again?`}>
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Add someone</h2>
            <form action={addAdminAction} className="a-form" autoComplete="off">
              <div className="a-field">
                <label htmlFor="tn">Name</label>
                <input id="tn" name="name" required maxLength={80} />
              </div>
              <div className="a-field">
                <label htmlFor="te">Email</label>
                <input id="te" name="email" type="email" required autoComplete="off" />
              </div>
              <div className="a-field">
                <label htmlFor="tr">Role</label>
                <select id="tr" name="role" defaultValue="staff">
                  <option value="staff">Staff: orders, customers, inbox</option>
                  <option value="admin">Admin: everything except the team</option>
                  <option value="owner">Owner: everything</option>
                </select>
              </div>
              <div className="a-field">
                <label htmlFor="tp">Temporary password</label>
                <input id="tp" name="password" type="password" minLength={10} required autoComplete="new-password" />
                <span className="hint">At least 10 characters. Share it privately; they can change it after signing in.</span>
              </div>
              <SubmitButton className="a-btn copper">Add to the team</SubmitButton>
            </form>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Set a new password</h2>
            <form action={resetAdminPasswordAction} className="a-form" autoComplete="off">
              <div className="a-field">
                <label htmlFor="rp-who">Person</label>
                <select id="rp-who" name="id">
                  {team
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </div>
              <div className="a-field">
                <label htmlFor="rp-pw">New password</label>
                <input id="rp-pw" name="password" type="password" minLength={10} required autoComplete="new-password" />
              </div>
              <SubmitButton className="a-btn ghost" confirm="Change this person's password? They will be signed out.">
                Set password
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
