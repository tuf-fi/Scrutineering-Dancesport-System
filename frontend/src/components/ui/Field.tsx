import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn.ts'

const control =
  'w-full rounded-md border bg-white px-3 text-body text-neutral-900 transition-colors ' +
  'hover:border-neutral-400 focus-visible:border-brown-700 focus-visible:outline-gold-500 ' +
  'disabled:bg-neutral-100 disabled:text-neutral-500'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  id: string
  children: ReactNode
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold text-neutral-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-small text-neutral-600">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface CommonProps {
  label: string
  hint?: string
  error?: string
}

function describe(id: string, hint?: string, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || hint ? `${id}-msg` : undefined,
  }
}

export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        id={id}
        className={cn(control, 'h-11', error ? 'border-danger' : 'border-neutral-300', className)}
        {...describe(id, hint, error)}
        {...props}
      />
    </FieldShell>
  )
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <select
        id={id}
        className={cn(control, 'h-11', error ? 'border-danger' : 'border-neutral-300', className)}
        {...describe(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function Textarea({
  label,
  hint,
  error,
  className,
  rows = 4,
  ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <textarea
        id={id}
        rows={rows}
        className={cn(control, 'py-2.5', error ? 'border-danger' : 'border-neutral-300', className)}
        {...describe(id, hint, error)}
        {...props}
      />
    </FieldShell>
  )
}
