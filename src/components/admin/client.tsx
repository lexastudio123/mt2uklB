'use client';

import { useEffect, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/** Submit button with a pending state and an optional confirmation prompt. */
export function SubmitButton({
  children,
  className = 'a-btn',
  pending: pendingLabel,
  confirm,
  formAction,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  pending?: string;
  confirm?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      formAction={formAction}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Header checkbox that ticks every row checkbox with the same name in its form. */
export function CheckAll({ name, label = 'Select all' }: { name: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}

export function PrintButton({ label = 'Print', className = 'a-btn copper' }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}

/** Opens the print dialog once when the page loads with ?print=1. */
export function AutoPrint({ on }: { on: boolean }) {
  useEffect(() => {
    if (on) setTimeout(() => window.print(), 300);
  }, [on]);
  return null;
}

/** A select that submits its form as soon as it changes (filters). */
export function AutoSelect({ name, defaultValue, children, label }: { name: string; defaultValue?: string; children: ReactNode; label: string }) {
  return (
    <select name={name} defaultValue={defaultValue} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  );
}
