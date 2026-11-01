import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import { LoginForm } from './form';

export const metadata = { title: 'Sign in' };

export default async function AdminLogin() {
  if (await getAdmin()) redirect('/admin');
  return (
    <div className="a-login">
      <div className="a-login-card">
        <div className="top">
          <span className="a-brand">
            MT2 LAB<small>UK</small>
            <em>Admin</em>
          </span>
        </div>
        <div className="a-tones" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="body">
          <h1>Sign in</h1>
          <p className="a-small" style={{ margin: '0 0 18px' }}>
            For the MT2 Lab team. Forgotten your password? Ask the shop owner to reset it, or run <span className="a-code">npm run admin:create</span> on the server.
          </p>
          <LoginForm />
          <p className="a-small" style={{ margin: '18px 0 0' }}>
            <Link href="/" className="a-link muted">
              Back to the shop
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
