import { Select } from '../../components/ui/index.ts'

export function CompetitionSelect({
  list,
  value,
  onChange,
}: {
  list: Array<{ id: string; name: string }>
  value: string | undefined
  onChange: (id: string) => void
}) {
  return (
    <div className="w-full sm:w-72">
      <Select label="Competition" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={list.length === 0}>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
