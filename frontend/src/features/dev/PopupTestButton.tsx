import { Bell } from 'lucide-react'
import { usePopups } from '../../stores/popups.ts'

// Development only: a floating button, bottom right, that fires a test pop-up, with its sound, on whatever page is open
export function PopupTestButton() {
  return (
    <button
      type="button"
      aria-label="Test pop-up"
      title="Test pop-up"
      onClick={() => usePopups.getState().push({ title: 'Test notification', detail: 'This is how a pop-up looks and sounds.', link: null })}
      className="fixed bottom-4 right-4 z-50 grid size-12 place-items-center rounded-full bg-black text-white shadow-overlay transition-colors hover:bg-gold-400 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
    >
      <Bell aria-hidden className="size-5" strokeWidth={1.75} />
    </button>
  )
}
