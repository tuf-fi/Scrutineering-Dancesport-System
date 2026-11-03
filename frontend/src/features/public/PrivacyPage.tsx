import { PublicHeader } from './PublicHeader.tsx'

// TODO: the organizer must read and confirm this notice (details are kept permanently until removed)
const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we keep',
    body: [
      'From the entry form: for each dancer the name, date of birth, address, email and contact number; the province, the team and the coach; whether the entry is a beginners (BGB) entry; and the year the membership was paid.',
      'For a team or a coach: the name, a contact person, a contact number and an email. For a coach, also the years the membership and the Coaches Summit were paid.',
      'For an athlete account: the name, email and a scrambled form of the password (never the password itself), and the details the athlete fills in on their own page (date of birth, contact number, address, province, team and coach).',
      'For payments: the amount, how it was paid, the reference number and who recorded it. Card details and bank logins are never kept.',
    ],
  },
  {
    title: 'Why',
    body: [
      'To take entries, work out each dancer’s age group, record payments, run the competition and publish the results. Nothing is used for advertising and nothing is sold or shared with other companies.',
    ],
  },
  {
    title: 'Who sees it',
    body: [
      'Only the organizer’s staff see dates of birth, addresses, emails, contact numbers and payments. An athlete who signs in sees only their own page.',
      'Results, placings, ranking points, dancer names and team names are public, because that is what a published result is. Many dancers are minors, so the entry form should be signed with a parent’s or guardian’s agreement.',
    ],
  },
  {
    title: 'How long',
    body: [
      'Entry form details are kept permanently as the organizer’s record. Nothing is deleted automatically; details are removed only when the organizer does it, or when you ask. Results and rankings are kept as the public record.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'A dancer, a parent or guardian, a team or a coach can ask the organizer to see, correct or remove their details. Removing them keeps the name in published results.',
      'This follows the Data Privacy Act of 2012 (Republic Act 10173).',
    ],
  },
]

export function PrivacyPage() {
  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      <PublicHeader title="Privacy notice" eyebrow="Data Privacy Act of 2012" description="What BIS keeps about dancers, teams and coaches, and for how long." />
      <div className="flex flex-col">
        {SECTIONS.map((section, i) => (
          <section key={section.title} className="grid gap-4 border-b border-neutral-200 py-8 first:pt-0 lg:grid-cols-[14rem_1fr] lg:gap-12">
            <h2 className="flex items-baseline gap-3 text-[1.25rem] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">
              <span className="font-mono text-xs font-medium tabular-nums text-neutral-500">{String(i + 1).padStart(2, '0')}</span>
              {section.title}
            </h2>
            <div className="flex max-w-2xl flex-col gap-3">
              {section.body.map((text) => (
                <p key={text} className="text-body text-neutral-700">
                  {text}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
