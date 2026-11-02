const KEY = 'bis-notification-sound'

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Without storage the choice only lasts until the page closes
  }
}

let audio: AudioContext | undefined

// A short two-note chime made in the browser, so there is no sound file to ship. Browsers keep sound off until the person
// has used the page once; when it is blocked this stays silent and the badge still shows the notification.
export function playChime() {
  if (!soundOn()) return
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    audio ??= new Context()
    void audio.resume()
    const start = audio.currentTime
    ;[880, 1318.5].forEach((frequency, i) => {
      const oscillator = audio!.createOscillator()
      const gain = audio!.createGain()
      const at = start + i * 0.14
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4)
      oscillator.connect(gain).connect(audio!.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.42)
    })
  } catch {
    // No sound is not worth an error
  }
}
