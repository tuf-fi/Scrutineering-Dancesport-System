import { Eye, EyeOff } from 'lucide-react'
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn.ts'

const control =
  'w-full rounded-md border bg-neutral-50 px-3.5 text-body text-neutral-900 transition-colors ' +
  'hover:border-neutral-400 focus-visible:border-neutral-900 focus-visible:bg-white ' +
  'focus-visible:outline-gold-500 disabled:bg-neutral-100 disabled:text-neutral-500'

interface CommonProps {
  label: string
  // Keeps the label for screen readers only, for fields whose column header already names them
  hideLabel?: boolean
  hint?: string
  error?: string
}

interface FieldShellProps extends CommonProps {
  id: string
  required?: boolean
  children: ReactNode
}

function FieldShell({ label, hideLabel, hint, error, id, required, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          'text-small font-medium text-neutral-700',
          hideLabel && 'sr-only',
          // The red asterisk is drawn by the label, so the label text itself stays the name of the field
          required && !hideLabel && "after:ml-0.5 after:text-danger after:content-['*']",
        )}
      >
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

function describe(id: string, hint?: string, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || hint ? `${id}-msg` : undefined,
  }
}

export function Input({
  label,
  hideLabel,
  hint,
  error,
  className,
  ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const secret = props.type === 'password'
  const input = (
    <input
      id={id}
      className={cn(control, 'h-10', secret && 'pr-11', error ? 'border-danger' : 'border-neutral-300', className)}
      {...describe(id, hint, error)}
      {...props}
      type={secret && shown ? 'text' : props.type}
    />
  )
  return (
    <FieldShell label={label} hideLabel={hideLabel} hint={hint} error={error} id={id} required={props.required}>
      {secret ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-neutral-500 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-gold-500"
          >
            {shown ? <EyeOff aria-hidden className="size-[18px]" strokeWidth={1.75} /> : <Eye aria-hidden className="size-[18px]" strokeWidth={1.75} />}
          </button>
        </div>
      ) : (
        input
      )}
    </FieldShell>
  )
}

export function Select({
  label,
  hideLabel,
  hint,
  error,
  className,
  children,
  ...props
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell label={label} hideLabel={hideLabel} hint={hint} error={error} id={id} required={props.required}>
      <select
        id={id}
        className={cn(control, 'h-10', error ? 'border-danger' : 'border-neutral-300', className)}
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
  hideLabel,
  hint,
  error,
  className,
  rows = 4,
  ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell label={label} hideLabel={hideLabel} hint={hint} error={error} id={id} required={props.required}>
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
