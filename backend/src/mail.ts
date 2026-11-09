import type { Config } from './config.ts'

export interface MailMessage {
  to: string
  subject: string
  // Plain text, with the link on its own line. A person with a text-only mail app can still use it.
  text: string
}

// What the server sends mail through. `enabled` is false when no provider is set: there is then no way to verify an
// address, so the server does not ask for it.
export interface Mailer {
  enabled: boolean
  send(message: MailMessage): Promise<void>
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

// "BOSS <no-reply@example.com>" or a bare address
function sender(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from)
  return m ? { name: m[1] || undefined, email: m[2]! } : { email: from.trim() }
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Plain text turned into a simple page, with each web address made a link
const toHtml = (text: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, '<br>')}</div>`

// Brevo (https://www.brevo.com) sends transactional mail from a free account: 300 a day, no card needed.
export function brevoMailer(apiKey: string, from: string, fetcher: typeof fetch = fetch): Mailer {
  return {
    enabled: true,
    async send(message) {
      const res = await fetcher(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: sender(from), to: [{ email: message.to }], subject: message.subject, textContent: message.text, htmlContent: toHtml(message.text) }),
      })
      if (!res.ok) throw new Error(`Brevo refused the message (${res.status}): ${(await res.text()).slice(0, 200)}`)
    },
  }
}

// With no provider the message is only printed, so a developer can click the link from the console
export function consoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    enabled: false,
    async send(message) {
      log(`[mail not sent: no provider set] To: ${message.to}\nSubject: ${message.subject}\n${message.text}`)
    },
  }
}

export function createMailer(config: Config): Mailer {
  return config.mail.brevoApiKey ? brevoMailer(config.mail.brevoApiKey, config.mail.from) : consoleMailer()
}

// ---- The messages ----

const sign = 'BOSS · Bicol Oragon Scruteneering System'

export const verifyMessage = (to: string, name: string, link: string): MailMessage => ({
  to,
  subject: 'Confirm your email address',
  text: `Hello ${name},\n\nConfirm your email address to finish setting up your account:\n\n${link}\n\nThe link works for 24 hours. If you did not make an account, ignore this email.\n\n${sign}`,
})

export const resetMessage = (to: string, name: string, link: string): MailMessage => ({
  to,
  subject: 'Reset your password',
  text: `Hello ${name},\n\nSomeone asked to reset the password of your account. Choose a new one here:\n\n${link}\n\nThe link works once, for 1 hour. If this was not you, ignore this email: your password stays as it is.\n\n${sign}`,
})
