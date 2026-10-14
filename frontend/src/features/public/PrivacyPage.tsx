import { PageHeader } from '../../components/ui/index.ts'

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: 'What we keep',
    body: [
      'For a club: the club name, a contact person, an email address, a mobile number and a password (stored scrambled, never readable).',
      'For dancers: the names, the age group and the club. Birth dates are not collected.',
      'For payments: the amount, the reference number and a screenshot of the receipt.',
    ],
  },
  {
    title: 'Why',
    body: [
      'To take entries, check payments, run the competition and publish the results. Nothing is used for advertising and nothing is sold or shared with other companies.',
    ],
  },
  {
    title: 'Who sees it',
    body: [
      'Receipt screenshots are seen only by the organizer’s admins and by the club that sent them. Contact details are seen only by organizer staff.',
      'Results, placings, ranking points, dancer names and club names are public, because that is what a published result is. Many dancers are minors, so a club should have a parent’s or guardian’s agreement before entering them.',
    ],
  },
  {
    title: 'How long',
    body: [
      'Receipt screenshots are deleted 90 days after the competition. Results and rankings are kept as the public record.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'A club can ask the organizer to see, correct or erase its contact details. Erasing removes the contact person, email, mobile number, login and receipts. The club name and dancers stay in published results.',
      'This follows the Data Privacy Act of 2012 (Republic Act 10173).',
    ],
  },
]

export function PrivacyPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader title="Privacy notice" description="What BIS keeps about clubs and dancers, and for how long." />
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
