import { Radio } from 'lucide-react'

// Jumps to the round on the floor; hidden when that round is already showing
export function GoToFloor({ floorId, roundId, onGo }: { floorId: string; roundId: string; onGo: (roundId: string) => void }) {
  if (!floorId || floorId === roundId) return null
  return (
    <button
      type="button"
      onClick={() => onGo(floorId)}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-gold-400 px-3 text-small font-semibold text-black transition-colors hover:bg-gold-300 active:bg-gold-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
    >
      <Radio aria-hidden size={16} strokeWidth={2} />
      Go to the floor
    </button>
  )
}
