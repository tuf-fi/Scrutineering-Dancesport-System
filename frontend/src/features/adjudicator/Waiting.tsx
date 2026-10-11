// TODO: static until step 8 connects it to the live round state
export function Waiting() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <h1 className="max-w-2xl text-display font-semibold text-neutral-900">Waiting for the next round</h1>
      <p className="max-w-prose text-body text-neutral-600">
        The scrutineer will start it. This screen changes by itself when your marks are needed.
      </p>
    </div>
  )
}
