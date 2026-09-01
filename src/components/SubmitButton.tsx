"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that disables itself and says what it is doing while the
 * server action runs. Prevents the double-tap double-signup that a slow
 * connection would otherwise cause.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
