import { useState } from 'react'
import { ConnectionStatus } from './components/ConnectionStatus.tsx'
import { DataPreview } from './DataPreview.tsx'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Tabs,
  Textarea,
  ToastViewport,
  useToast,
} from './components/ui/index.ts'

// TODO: temporary design-system preview; replaced by the router and role layouts in step 5
const rows = [
  { back: 60, names: 'Santos, Mia', xs: 7 },
  { back: 107, names: 'Reyes, Lian', xs: 6 },
  { back: 179, names: 'Cruz, Ana', xs: 4 },
]

export default function App() {
  const [tab, setTab] = useState('cha')
  const [open, setOpen] = useState(false)
  const toast = useToast((s) => s.show)

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <PageHeader
        eyebrow="E47 · Junior I · E1"
        title="Cha Cha Cha"
        description="Design system preview."
        actions={
          <>
            <ConnectionStatus />
            <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
            <Button onClick={() => toast('Submitted', 'success')}>Show toast</Button>
          </>
        }
      />

      <section className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
        <Button size="xl">Submit</Button>
      </section>

      <section className="flex flex-wrap gap-2">
        <Badge>Unpaid</Badge>
        <Badge tone="gold">For checking</Badge>
        <Badge tone="success" dot>Approved</Badge>
        <Badge tone="danger">Rejected</Badge>
        <Badge tone="warning" dot>Offline</Badge>
        <Badge tone="brown">Final</Badge>
      </section>

      <Tabs
        label="Dances"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'cha', label: 'Cha Cha Cha' },
          { id: 'rumba', label: 'Rumba' },
          { id: 'jive', label: 'Jive' },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <Input label="Username" hint="Issued by the admin" />
          <Input label="Reference number" error="Enter the 13-digit reference" />
          <Select label="Age group">
            <option>Junior I</option>
            <option>Junior II</option>
          </Select>
          <Textarea label="Rejection reason" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <EmptyState title="No payments waiting" description="New proofs of payment appear here." />
        </Card>
      </section>

      <Table
        columns={[
          { key: 'back', header: 'Back', cell: (r) => r.back, mono: true },
          { key: 'names', header: 'Competitor', cell: (r) => r.names },
          { key: 'xs', header: 'X', cell: (r) => r.xs, mono: true, align: 'right' },
        ]}
        rows={rows}
        rowKey={(r) => String(r.back)}
        rowClassName={(r) => (r.xs === 4 ? 'bg-gold-50' : undefined)}
      />
      <Table columns={[{ key: 'a', header: 'Loading', cell: () => null }]} rows={[]} rowKey={() => ''} loading />

      <DataPreview />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Publish this result?"
        description="E47 Round 1 goes to the venue screen and the public site."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Publish</Button>
          </>
        }
      />
      <ToastViewport />
    </main>
  )
}
