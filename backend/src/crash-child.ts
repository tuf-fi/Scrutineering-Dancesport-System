// Run by reliability.test.ts: saves one adjudicator's marks, starts a second change, then is killed
// with that change still open, the way a power cut or a crash would stop the server.
import { openDatabase } from './db/client.ts'
import * as t from './db/schema.ts'
import { newId, now } from './ids.ts'

const [path, roundId, adjudicatorId, competitorId] = process.argv.slice(2) as [string, string, string, string]
const { sqlite, db } = openDatabase(path)

const mark = (dance: 'samba') => ({ id: newId(), roundId, adjudicatorId, competitorId, dance, kind: 'x' as const, placing: null, submittedAt: now() })

// Saved: this transaction completes
sqlite.transaction(() => {
  db.insert(t.marks).values(mark('samba')).run()
  db.insert(t.submissions).values({ roundId, adjudicatorId, submittedAt: now(), enteredBy: null }).run()
})()

// Not saved: the transaction is still open when the process is killed
sqlite.exec('begin')
db.insert(t.competitions).values({ id: 'half-written', name: 'Half written', date: '2026-01-01', venue: 'x', organizer: 'x' }).run()
console.log('ready')
process.kill(process.pid, 'SIGKILL')
