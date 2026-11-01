import { PageHeader } from '../../components/ui/index.ts'

// TODO: the organizer must read and confirm this notice, including how long entry form details are kept
const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we keep',
    body: [
      'From the entry form: for each dancer the name, date of birth, address, email and contact number; the province, the club and the coach; whether the entry is a beginners (BGB) entry; and the year the membership was paid.',
      'For a club or a coach: the name, a contact person, a contact number and an email. For a coach, also the years the membership and the Coaches Summit were paid.',
      'For an athlete account: the name, email and a scrambled form of the password (never the password itself), and the details the athlete fills in on their own page (date of birth, contact number, address, province, club and coach).',
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
      'Results, placings, ranking points, dancer names and club names are public, because that is what a published result is. Many dancers are minors, so the entry form should be signed with a parent’s or guardian’s agreement.',
    ],
  },
  {
    title: 'How long',
    body: [
      'Entry form details are kept for the organizer’s records until the organizer removes them. Results and rankings are kept as the public record.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'A dancer, a parent or guardian, a club or a coach can ask the organizer to see, correct or remove their details. Removing them keeps the name in published results.',
      'This follows the Data Privacy Act of 2012 (Republic Act 10173).',
    ],
  },
]

export function PrivacyPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader title="Privacy notice" description="What BIS keeps about dancers, clubs and coaches, and for how long." />
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-title font-semibold text-neutral-900">{section.title}</h2>
          {section.body.map((text) => (
            <p key={text} className="text-body text-neutral-700">
              {text}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}
