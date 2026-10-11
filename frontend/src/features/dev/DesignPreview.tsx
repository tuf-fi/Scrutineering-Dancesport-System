import { useState, type ReactNode } from 'react'
import { ConnectionStatus } from '../../components/ConnectionStatus.tsx'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Input,
  Select,
  Tabs,
  toast,
} from '../../components/ui/index.ts'
import { DataPreview } from './DataPreview.tsx'

// Development-only review page for the design system and the sample data layer (/dev/design)

function Spec({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-neutral-200 py-6 sm:grid-cols-[10rem_1fr] sm:gap-8">
      <h3 className="text-small font-medium text-neutral-600">{name}</h3>
      <div>{children}</div>
    </div>
  )
}

export function DesignPreview() {
  const [tab, setTab] = useState('cha')
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-8">
          <span className="text-body font-bold tracking-[-0.02em]">BIS</span>
          <ConnectionStatus />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-24 px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
        <DataPreview />

        <section className="flex flex-col gap-6">
          <h2 className="text-title font-semibold">Components</h2>
          <div>
            <Spec name="Buttons">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Approve</Button>
                <Button variant="secondary">Print list</Button>
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Reject</Button>
                <Button disabled>Submit</Button>
              </div>
            </Spec>
            <Spec name="Status">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Badge tone="neutral">Unpaid</Badge>
                <Badge tone="gold">For checking</Badge>
                <Badge tone="success">Approved</Badge>
                <Badge tone="danger">Rejected</Badge>
                <Badge tone="warning">Offline</Badge>
              </div>
            </Spec>
            <Spec name="Tabs">
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
            </Spec>
            <Spec name="Fields">
              <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
                <Input label="Reference number" hint="From the GCash receipt" />
                <Input label="Amount" error="Enter the amount paid" />
                <Select label="Age group">
                  <option>Junior I</option>
                  <option>Junior II</option>
                </Select>
              </div>
            </Spec>
            <Spec name="Empty">
              <EmptyState title="No payments waiting" description="New proofs of payment appear here." />
            </Spec>
            <Spec name="Overlays">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setOpen(true)}>
                  Publish result
                </Button>
                <Button variant="secondary" onClick={() => toast.success('Submitted')}>
                  Show toast
                </Button>
              </div>
            </Spec>
          </div>
        </section>
      </main>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Publish this result?"
        description="It goes to the venue screen and the public site."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Publish</Button>
          </>
        }
      />
    </>
  )
}
