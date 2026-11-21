export type HeatMap = Map<string, number>

// Every edit returns a new map; saving renumbers heats from 1 on the server, so gaps are fine here
export function mergeHeats(map: HeatMap, from: number, into: number): HeatMap {
  return new Map([...map].map(([id, heat]) => [id, heat === from ? into : heat]))
}

export function swapCouples(map: HeatMap, a: string, b: string): HeatMap {
  if (map.get(a) === map.get(b)) return map
  const next = new Map(map)
  next.set(a, map.get(b) ?? 1)
  next.set(b, map.get(a) ?? 1)
  return next
}

// Moves heat `from` to position `to`; the heats in between shift by one
export function moveHeat(map: HeatMap, from: number, to: number): HeatMap {
  const shift = from < to ? -1 : 1
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  return new Map(
    [...map].map(([id, heat]) => [id, heat === from ? to : heat >= low && heat <= high ? heat + shift : heat]),
  )
}
