// Who the public Bicol Athletes list shows: an athlete or couple with an entry in the ranking (an entry that earned
// points) in Juvenile, Junior or Youth. A Junior solo counts only for a female dancer (Solo Junior Female); a Junior
// couple, a Youth solo or couple and any Juvenile entry count for everyone. Adult and Senior are not listed.
// Age groups are matched by the id their family started with, so a newer version of a group still counts.
const JUVENILE = ['juvenile_1', 'juvenile_2']
const JUNIOR = ['junior_1', 'junior_2']
const YOUTH = ['youth']

export function listedInBicolAthletes(ageGroupFamily: string, solo: boolean, gender: string | undefined): boolean {
  if (JUVENILE.includes(ageGroupFamily) || YOUTH.includes(ageGroupFamily)) return true
  if (JUNIOR.includes(ageGroupFamily)) return !solo || gender === 'female'
  return false
}
