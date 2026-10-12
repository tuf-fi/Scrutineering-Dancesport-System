import { Button, Dialog, toast } from '../../components/ui/index.ts'

// Shows a one-time password; the admin passes it on in person
export function TempPasswordDialog({
  title,
  person,
  password,
  onClose,
}: {
  title: string
  person: string
  password: string | null
  onClose: () => void
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(password ?? '')
      toast.success('Copied')
    } catch {
      toast.error('Could not copy. Select the password and copy it.')
    }
  }

  return (
    <Dialog
      open={password !== null}
      onClose={onClose}
      title={title}
      description={`Give this temporary password to ${person}. It is shown only once.`}
      actions={
        <>
          <Button variant="ghost" onClick={copy}>
            Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <p className="rounded-md bg-neutral-100 px-4 py-3 font-mono text-title tracking-wide select-all">
        {password}
      </p>
    </Dialog>
  )
}
