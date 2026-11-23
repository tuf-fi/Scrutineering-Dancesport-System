// Gives the scenario data (backend `db:scenario`) believable emails, phone numbers and payment accounts, so
// screenshots look like a real competition. Run on a throwaway database only:
//   DATABASE_PATH=<db> node rehearsal/polish-data.mjs <server address>
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const Database = createRequire(join(ROOT, 'backend', 'package.json'))('better-sqlite3')
const BASE = process.argv[2] ?? 'http://localhost:4062'
const DB = process.env.DATABASE_PATH
if (!DB) throw new Error('Set DATABASE_PATH to the throwaway database.')
const db = new Database(DB)

const slug = (s) => s.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).filter((w) => w.length > 1).join('.')
const DOMAINS = ['gmail.com', 'gmail.com', 'yahoo.com', 'gmail.com', 'outlook.com']
const PREFIX = ['0917', '0918', '0919', '0927', '0928', '0956', '0995', '0936']
const phone = (i) => `${PREFIX[i % PREFIX.length]} ${String(300 + ((i * 53) % 690))} ${String(1000 + ((i * 7919) % 9000))}`
let n = 0

// Staff and sign-in accounts
const STAFF = {
  'admin@sample.example': 'amelia.rosales@gmail.com',
  'secretariat@sample.example': 'jonas.bellosillo@gmail.com',
  'scrutineer@sample.example': 'teresita.quimpo@gmail.com',
  'chairperson@sample.example': 'gregorio.almazan@gmail.com',
  'compere@sample.example': 'dante.ibarra@gmail.com',
  'barker@sample.example': 'ruben.soriano@gmail.com',
}
for (const [from, to] of Object.entries(STAFF)) db.prepare('UPDATE staff_users SET username = ? WHERE username = ?').run(to, from)

const MEMBERS = {
  'team@sample.example': ['naga.rhythm.studio@gmail.com', 'Naga Rhythm Studio'],
  'team2@sample.example': ['legazpi.dance.collective@gmail.com', 'Legazpi Dance Collective'],
  'coach@sample.example': ['marites.villareal@gmail.com', null],
}
for (const [from, [email, name]] of Object.entries(MEMBERS)) {
  db.prepare('UPDATE member_accounts SET email = ? WHERE email = ?').run(email, from)
  if (name) db.prepare('UPDATE member_accounts SET name = ? WHERE email = ?').run(name, email)
}
db.prepare('UPDATE athletes SET email = ?, phone = ? WHERE email = ?').run('kai.ibarra@gmail.com', '0917 842 3156', 'athlete@sample.example')

for (const t of db.prepare('SELECT id, name, contact_name FROM teams').all()) {
  db.prepare('UPDATE teams SET contact_email = ?, contact_phone = ? WHERE id = ?').run(`${slug(t.name)}@gmail.com`, phone(n++), t.id)
}
for (const c of db.prepare('SELECT id, name FROM coaches').all()) {
  db.prepare('UPDATE coaches SET email = ?, phone = ? WHERE id = ?').run(`${slug(c.name)}@gmail.com`, phone(n++), c.id)
}
for (const c of db.prepare('SELECT id, names, details FROM competitors').all()) {
  const names = JSON.parse(c.names)
  const d = JSON.parse(c.details ?? '{}')
  if (!Array.isArray(d.dancers)) continue
  d.dancers.forEach((x, i) => {
    x.email = `${slug(names[i] ?? names[0])}${(n % 3) + 1 === 1 ? '' : (n % 90) + 10}@${DOMAINS[n % DOMAINS.length]}`
    x.phone = phone(n++)
  })
  db.prepare('UPDATE competitors SET details = ? WHERE id = ?').run(JSON.stringify(d), c.id)
}
db.close()

// Payment accounts, through the real server
const post = async (path, body, cookie) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r
}
const login = await post('/api/auth/staff', { username: STAFF['admin@sample.example'], password: 'bis2026' })
const cookie = login.headers.get('set-cookie').split(';')[0]
const call = async (name, ...args) => (await (await post(`/api/call/${name}`, { args }, cookie)).json()).data
const settings = await call('getPaymentSettings')
const ACCOUNTS = { gcash: ['0917 842 3156', 'Camarines Sur Dancesport Association'], maya: ['0918 456 7821', 'Camarines Sur Dancesport Association'], bank: ['1234 5678 90', 'Camarines Sur Dancesport Association'] }
const methods = settings.methods.map((m) => {
  const k = Object.keys(ACCOUNTS).find((key) => m.name.toLowerCase().includes(key))
  return k ? { ...m, number: ACCOUNTS[k][0], accountName: ACCOUNTS[k][1] } : m
})
await call('savePaymentSettings', { ...settings, methods })
console.log('data polished; staff addresses:', Object.values(STAFF).join(', '))
