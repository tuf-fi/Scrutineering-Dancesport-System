// Builds the BOSS Offline Mode manual (offline-manual.html and BOSS_Offline_Mode_Manual.pdf) in the style of the user manual.
// Take the screenshots first: `node rehearsal/offline-manual-shots.mjs`. Then `node rehearsal/offline-manual-build.mjs`.
// The PDF is also copied to docs/operations/OFFLINE_MODE_MANUAL.pdf.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIR = process.env.OFFLINE_MANUAL_OUT ?? join(import.meta.dirname, 'shots', 'offline-manual')
const APP = pathToFileURL(ROOT).href
const PDF = join(DIR, 'BOSS_Offline_Mode_Manual.pdf')

// ---------------------------------------------------------------------------------------------- images
function jpegSize(file) {
  const b = readFileSync(file)
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    i += 2 + b.readUInt16BE(i + 2)
  }
  throw new Error('no size in ' + file)
}
const missing = []
// A screenshot. Whole-page shots are cropped (y, h in their own pixels); dialogs are shown as they are.
function img(key, cap, o = {}) {
  const file = join(DIR, 'images', key + '.jpg')
  if (!existsSync(file)) {
    missing.push(key)
    return ''
  }
  const { w, h } = jpegSize(file)
  const phone = w === 780
  const fullPage = w === 1280 || w === 780
  const src = `images/${key}.jpg`
  let style, inner
  if (fullPage) {
    const y = o.y ?? 0
    const ch = Math.min(o.h ?? (phone ? 1400 : 560), h - y)
    const mm = o.mm ?? (phone ? 46 : 170)
    style = `width:${mm}mm;aspect-ratio:${w}/${ch}`
    inner = `<img src="${src}" style="margin-top:${(-y / w) * 100}%">`
  } else {
    const mm = o.mm ?? Math.min(150, (w / 1280) * 178)
    style = `width:${mm}mm;max-height:${o.maxh ?? 130}mm`
    inner = `<img src="${src}">`
  }
  return `<figure class="${phone ? 'phone' : ''}"><div class="shot" style="${style}">${inner}</div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`
}
const I = img

// ---------------------------------------------------------------------------------------------- blocks
const list = (items) => (items?.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '')
let sectionNo = 0
const sections = []
function divider(name, who, lines) {
  sectionNo++
  sections.push({ n: String(sectionNo).padStart(2, '0'), name, who })
  return `<section class="divider"><div class="d-in"><p class="d-num">${String(sectionNo).padStart(2, '0')}</p><div class="d-bar"></div><h1>${name}</h1><p class="d-who">${who}</p>${lines ? `<p class="d-lines">${lines}</p>` : ''}</div></section>`
}
function feat(title, where, desc, bullets, imgs = [], phone = false) {
  return `<article class="feat ${phone ? 'cell' : ''}"><div class="txt"><h2 class="ft">${title}</h2>${where ? `<p class="where">${where}</p>` : ''}<p>${desc}</p>${list(bullets)}</div>${imgs.length ? `<div class="imgs">${imgs.join('')}</div>` : ''}</article>`
}
const page = (...blocks) => `<section class="body">${blocks.join('\n')}</section>`
const pageNew = (...blocks) => `<section class="body" style="break-before:page">${blocks.join('\n')}</section>`
const note = (t) => `<div class="note">${t}</div>`
const step = (n, who, title, text, imgs = []) => `<div class="step"><div class="sn">${String(n).padStart(2, '0')}</div><div class="sb"><p class="sr">${who}</p><h3>${title}</h3><p>${text}</p>${imgs.length ? `<div class="imgs">${imgs.join('')}</div>` : ''}</div></div>`
const chain = (rows) => `<div class="chain">${rows.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>`

// ---------------------------------------------------------------------------------------------- content
const out = []

out.push(`<div class="cover">
  <img src="${APP}/frontend/src/assets/logo.png" alt="BOSS">
  <div><div class="bar"></div><p class="kicker">Bicol Oragon Scrutineering System</p><h1>Offline Mode<br>Manual</h1>
  <p>How to run a competition day on a venue laptop with no internet, role by role, and how the day goes back online.</p></div>
  <p class="roles">Setting up · Visitors · Adjudicators · Scrutineer · Chairperson · Secretariat · Compere · Barker · Admin · Athletes, coaches and teams · Sending the day back</p>
</div>`)
out.push('@@TOC@@')

// ---- Start here
out.push(pageNew(`
<p class="num">Start here</p><h1>What offline mode is</h1>
<p class="lead">BOSS runs online. Offline mode is a fallback for one competition day, when the venue has no signal. One laptop at the venue runs BOSS for everyone, and the day is loaded back online afterwards.</p>
<p>The admin hands one competition to a laptop at the venue. The laptop runs the same program as the online server, on its own router, with no internet. Every role works as it does online, because it is the same program. When the day is over, the admin loads the day back online as one file.</p>
${chain([
  ['1. Before the event', 'Online. The admin presses Start offline day, then downloads a copy of the database and sets it up on the laptop.'],
  ['2. Competition day', 'Offline. Everyone joins the router\'s Wi-Fi and opens the laptop\'s address. Staff, the compere and the adjudicators work as usual.'],
  ['3. After the event', 'Online. The admin downloads the day file from the laptop and loads it on the online server.'],
])}
<h2>Online and offline at a glance</h2>
<table>
<tr><th></th><th>Online (normal)</th><th>Offline (venue laptop)</th></tr>
<tr><td>Where it runs</td><td>One hosted server</td><td>One laptop at the venue</td></tr>
<tr><td>Network</td><td>Internet, over HTTPS</td><td>The venue router's Wi-Fi, plain http, no internet needed</td></tr>
<tr><td>Address</td><td>The website address</td><td>The laptop's address on the router</td></tr>
<tr><td>Who can join</td><td>Anyone, anywhere</td><td>Only devices on the venue Wi-Fi</td></tr>
<tr><td>Registration and payments</td><td>Teams register and pay online</td><td>Entries, late entries and cash are handled at the venue</td></tr>
<tr><td>Emails</td><td>Sign-up, forgot password, links</td><td>Not available</td></tr>
<tr><td>Backups</td><td>On the server after every change</td><td>After every change and every two minutes, also to a USB drive</td></tr>
</table>
${note('Status: the screens, the lock, the file routes and the venue server are built and tested in code. They have not yet been rehearsed on a real venue laptop, router and phones. Do that rehearsal before relying on it.')}
`))

out.push(pageNew(`
<p class="num">Start here</p><h1>What works and what does not</h1>
<p class="lead">Everything that runs the competition day works offline. What does not work needs the internet itself.</p>
<h2>Works offline</h2>
<table>
<tr><th>What</th><th>Why it works</th></tr>
<tr><td>Rounds, heats, marking, approving, publishing</td><td>All scoring runs on the server, which is now the laptop. The Skating System needs no outside service.</td></tr>
<tr><td>Adjudicators marking on phones</td><td>Phones talk to the laptop over the router. If the router drops, a phone keeps its marks and sends them when the Wi-Fi returns.</td></tr>
<tr><td>Compere screen, barker board, live results</td><td>They read the laptop's database over the local network.</td></tr>
<tr><td>Late entries, scratches, back numbers, payments at the venue</td><td>These are changes to the laptop's database. Cash is paid at the venue and the secretariat records it.</td></tr>
<tr><td>Panels, PINs, the program, new teams, coaches, dancers and events, and printouts</td><td>Same screens, same database. Printing is done by the browser.</td></tr>
<tr><td>The public pages, for visitors on the venue Wi-Fi</td><td>The same program serves the program, live board and results from the laptop.</td></tr>
</table>
<h2>Does not work offline</h2>
<table>
<tr><th>What</th><th>Why</th></tr>
<tr><td>Sign-up, forgot password, email links, membership emails</td><td>They are sent through an outside mail provider, which needs internet. Offline, the emails are only printed in the laptop's log.</td></tr>
<tr><td>The public site on mobile data</td><td>The laptop has no public address. Visitors must join the venue Wi-Fi.</td></tr>
<tr><td>Online registration and payment by teams (GCash, Maya, bank)</td><td>These belong to the online server. While a competition is on a laptop, new entry requests are refused online.</td></tr>
<tr><td>Starting the offline day, and loading the day file</td><td>These buttons are on the online server only. The laptop can only download its day file.</td></tr>
</table>
`))

// ================================================================================ 01 Before the event
out.push(divider('Setting up', 'The admin online, then whoever sets up the laptop. Do it a day or two before.', 'Hand over · Database copy · Set up the laptop · Check · PIN cards · Rehearse'))
out.push(page(
  feat('Hand the competition to the laptop', 'Online: Admin, Offline day', 'Registration and payments finish first. Then the admin opens <b>Offline day</b> and presses <b>Start offline day</b> for the competition.', [
    'A box explains that staff changes and new entry requests are paused online until the day is loaded back.',
    'Press <b>Hand it over</b>. The competition now shows <b>Venue laptop, since</b> and its date.',
    '<b>Take back</b> releases it again without loading anything.',
  ], [I('online/offline-day', 'Offline day, online', { h: 520, mm: 82 }), I('online/start-dialog', 'Hand it over', { mm: 70 })]),
  feat('What the online server does meanwhile', 'Online: any staff screen', 'While a competition is with a laptop, the online server keeps its hands off it. Staff changes (secretariat, scrutineer, chairperson and the admin\'s own edits) and new entry requests are refused, with a message saying why.', [
    'Reading, the athletes\' own pages and the admin\'s offline-day buttons still work.',
    'This covers every competition, not only the one handed over. It is blunt on purpose, so it cannot be bypassed by mistake.',
  ], [I('online/handed-over', 'After handing over', { h: 520, mm: 82 }), I('online/paused', 'A change is refused online', { h: 300, mm: 82 })]),
  feat('Download the database copy', 'Online: Admin, Offline day, Download database copy', 'The copy holds every account and every password hash. Keep it private, and delete it from any USB drive afterwards.', [
    'The file is named <b>bis-venue-copy.db</b>.',
    'Put it in the <b>deploy\\venue</b> folder on the laptop.',
  ]),
))
out.push(pageNew(`
<h2 style="margin-top:0;border-top:0;padding-top:0">What you need</h2>
<table>
<tr><th>Item</th><th>Notes</th></tr>
<tr><td>A laptop</td><td>Windows with Docker Desktop. Plugged in all day, never asleep, with the right time and time zone. A spare laptop is strongly advised.</td></tr>
<tr><td>A Wi-Fi router</td><td>It does not need internet. Give the laptop the same address every time (a DHCP reservation). Turn off client isolation, or phones cannot reach the laptop.</td></tr>
<tr><td>A USB drive</td><td>Gets a copy of every change, as a second place the data lives.</td></tr>
<tr><td>Paper</td><td>Printed heat lists, recall lists and blank mark sheets, in case of trouble.</td></tr>
</table>
<h2>Set up the laptop</h2>
${step(1, 'Setup', 'Put BOSS on the laptop', 'Copy the repository to the laptop and open the <b>deploy\\venue</b> folder. Put <b>bis-venue-copy.db</b> there.')}
${step(2, 'Setup', 'Run setup.bat', 'Double-click <b>setup.bat</b>. It asks for the secret code (<b>DATA_KEY</b> from the online server\'s <b>deploy\\.env</b>; without it the staff\'s two-step codes will not work) and the USB drive letter. It then builds BOSS, loads the copy and starts it. Type <b>YES</b> when it asks, because it replaces anything on the laptop.')}
${step(3, 'Setup', 'Check it from a phone', 'Join the router\'s Wi-Fi and open the address <b>setup.bat</b> showed, followed by <b>/api/health</b>. It should show <b>"status":"ok"</b> and <b>"mode":"venue"</b>. Then open <b>/staff-access</b> and sign in.', [I('venue/health', 'The health check on the laptop', { mm: 100 }), I('venue/staff-access', 'The staff sign-in page on the laptop', { h: 560, mm: 70 })])}
${step(4, 'Admin', 'Print the PIN cards from the laptop', 'Open the laptop\'s own address in its browser, sign in as the admin, and use <b>Adjudicators and panels, Print PIN cards</b>. The QR code on each card holds the address you opened, so cards printed from the laptop point at the laptop. Cards printed from the online site would not work at the venue.', [I('venue/adjudicators', 'Adjudicators and panels, on the laptop', { h: 520, mm: 100 })])}
${step(5, 'Everyone', 'Rehearse', 'On the router with real phones, run a whole round: start it, mark on three phones, approve, publish, and check the compere\'s screen. Pull the router\'s power for a minute during marking and check the phones keep their marks and send them when it is back.')}
<p style="margin-top:4mm">The files in <b>deploy\\venue</b>: <b>setup.bat</b> (first time, and starting again from a copy), <b>start.bat</b> (after a restart, keeps everything), <b>stop.bat</b>, <b>show-address.bat</b> and <b>restore.bat</b> (spare laptop).</p>
`))

// ================================================================================ 02 Visitors
out.push(divider('Visitors', 'No account needed. Use your phone, on the venue Wi-Fi.', 'Find the site · Home · Competitions · Program · Results'))
out.push(page(
  feat('Find the public site', 'Admin on the laptop: Offline day', 'On the laptop, the <b>Offline day</b> page shows a QR code and the address of the public site. Show it on a screen, or press <b>Print</b> and put it on the wall.', [
    'Visitors join the venue Wi-Fi, then scan the code or type the address.',
    'Visitors on mobile data cannot reach it: the laptop has no public address.',
  ], [I('venue/offline-day', 'Offline day, on the laptop', { h: 520, mm: 110 })]),
  feat('Home', 'Open the address', 'The front page, the same as online.', ['Upcoming events and the latest competitions on the laptop.'], [I('venue-public/home', 'Home', { h: 1100 })], true),
  feat('Competitions', 'Menu: Competitions', 'The competitions in the laptop\'s copy. Press the one on the floor to open it.', [], [I('venue-public/competitions', 'Competitions')], true),
  feat('Program', 'Competition, Program', 'What is on the floor, what is next, and when everything starts. It updates as the scrutineer starts each round.', ['Search by name or back number, and filter by round.'], [I('venue-public/program', 'Program')], true),
  feat('Results', 'Menu: Results', 'Published results appear as soon as the scrutineer publishes a round. If the competition holds its results until the awarding, finals stay private until the scrutineer or chairperson presses <b>Reveal results</b>.', [], [I('venue-public/results', 'Results')], true),
))
out.push(page(`
<h2>The public page, online and offline</h2>
<table>
<tr><th></th><th>Online</th><th>Offline</th></tr>
<tr><td>Who can see it</td><td>Anyone with the web address, on any network.</td><td>Only people on the venue Wi-Fi.</td></tr>
<tr><td>How they find it</td><td>The website address, search engines and the sitemap.</td><td>A QR code and address on the Offline day page, to scan or print.</td></tr>
<tr><td>What they see</td><td>Competitions, program, live board, results, rankings and past competitions.</td><td>The same pages and data, for the one competition on the laptop.</td></tr>
<tr><td>Connection</td><td>HTTPS, behind Caddy.</td><td>Plain http on the local network.</td></tr>
<tr><td>Limit on visitors</td><td>600 requests a minute per address, adjustable.</td><td>No limit.</td></tr>
</table>
`))

// ================================================================================ 03 Adjudicators
out.push(divider('Adjudicators', 'Mark the dancers. Use your phone, on the venue Wi-Fi.', 'PIN · Waiting · Mark · Sign and submit'))
out.push(page(
  feat('Sign in with your PIN', 'The laptop\'s address followed by /adjudicator, or scan your card', 'Type the 6-digit PIN from your card. The QR code on the card holds the laptop\'s address, so scanning it opens the right place.', [
    'Join the venue Wi-Fi first. Mobile data cannot reach the laptop.',
    'A PIN only works around the competition date, and the laptop\'s clock decides. If a PIN is refused, tell the admin.',
  ], [I('venue-adjudicator/pin', 'PIN screen'), I('venue-adjudicator/pin-typed', 'Typing the PIN')], true),
  feat('Waiting for the next round', 'Adjudicator, Waiting', 'When there is no round for you, this screen waits. It changes by itself when the scrutineer starts the next round.', [], [I('venue-adjudicator/waiting', 'Waiting')], true),
  feat('Mark', 'Adjudicator, Mark', 'Marking is the same as online. Early rounds: tap the numbers of the dancers to go through, exactly the number shown. Final: place every finalist 1st to last. Then <b>Submit</b>, check, <b>Final and submit</b>, sign and press <b>Finalize</b>.', [
    'If the router drops, <b>your marks are kept on your phone</b>. They are sent when the Wi-Fi is back, and never twice.',
    'If the laptop restarts, your phone stays signed in and sends its marks by itself.',
  ], [I('venue-adjudicator/mark', 'Marking a round', { h: 1400 })], true),
))

// ================================================================================ 04 Scrutineer
out.push(divider('Scrutineer', 'Runs every round. Use a laptop, on the venue Wi-Fi.', 'Rounds · Live board · Results'))
out.push(page(
  feat('Run the rounds', 'Staff sign-in, then Scrutineer, Rounds', 'Everything works as online: plan the rounds, split into heats, start a round, watch the live board, check the recall, approve and publish. Staff sign in at the laptop\'s address followed by <b>/staff-access</b>.', [
    'If a phone cannot send, take the paper sheet and type it in on <b>Paper marks</b>.',
    'Staff screens show <b>Offline</b> if the laptop cannot be reached, and catch up when it returns.',
  ], [I('venue-scrutineer/rounds', 'Rounds', { h: 520, mm: 110 }), I('venue-scrutineer/live', 'Live board', { h: 520, mm: 110 })]),
  feat('Approve and publish', 'Scrutineer, Results', 'The same checks as online. Publishing puts the result on the public pages and the compere\'s screen on the laptop, and adds the ranking points.', [], [I('venue-scrutineer/results', 'Results', { h: 560, mm: 110 })]),
))

// ================================================================================ 05 Chairperson
out.push(divider('Chairperson', 'Watches the marks and confirms tie decisions. Use a laptop.', 'Live · Tie decisions'))
out.push(page(
  feat('Same as online', 'Staff sign-in, then Scrutineer', 'The chairperson can do everything the scrutineer can, and also presses <b>Confirm tie decision</b> when two couples share a place in a final. Nothing changes offline.', [
    'The scrutineer proposes how to settle the tie, and the chairperson confirms it. The scrutineer cannot confirm their own decision.',
    'The final cannot be approved until the tie is settled.',
  ], [I('venue-scrutineer/results', 'Results, where the tie is settled', { h: 560, mm: 110 })]),
))

// ================================================================================ 06 Secretariat
out.push(divider('Secretariat', 'Entries, back numbers, the program. Use a laptop.', 'Late entries · Payments at the venue · Athletes · Entry requests'))
out.push(page(
  feat('Late entries and payments at the venue', 'Secretariat, Late entries', 'A dancer arrives late: add them under <b>Late entries</b> and record the cash payment. They cannot dance until they have paid. A dancer withdraws: open the event and press <b>Scratch</b>.', [
    'These changes go back online with the day file.',
  ], [I('venue-secretariat/late-entries', 'Late entries', { h: 520, mm: 110 })]),
  feat('Athletes and back numbers', 'Secretariat, Athletes', 'Add dancers, assign back numbers and handle changes as online. Back numbers given or changed at the venue go back with the day file.', [], [I('venue-secretariat/athletes', 'Athletes', { h: 520, mm: 110 })]),
  feat('Entry requests', 'Secretariat, Entry requests', 'Requests handled at the venue go back with the day file. Teams cannot send new requests online while the laptop holds the competition, so do not ask them to register or pay online between handing over and loading the day.', [
    'There is no emailed payment review at the venue.',
  ], [I('venue-secretariat/entry-requests', 'Entry requests', { h: 520, mm: 110 })]),
))

// ================================================================================ 07 Compere and barker
out.push(divider('Compere and barker', 'Announce the rounds, and line the dancers up.', 'Compere screen · Barker board'))
out.push(page(
  feat('Compere', 'The laptop\'s address followed by /compere', 'The announcer\'s screen, the same as online. It shows the numbers to call, who is recalled and the results from last place to first. Use number keys or arrows for the next announcement.', [
    'The compere can start a round too, so the show goes on if the scrutineer\'s screen has a problem.',
    'Use a laptop or a projector on the venue Wi-Fi.',
  ], [I('venue-compere/announcer', 'The announcer screen', { h: 720, mm: 110 })]),
  feat('Barker', 'Staff sign-in, then Barker', 'The board of the rounds on the floor and the next event, with back numbers and names. The admin makes the barker\'s account.', [], [I('venue-barker/board', 'Barker board', { h: 1300 })], true),
))

// ================================================================================ 08 Admin
out.push(divider('Admin on the laptop', 'Runs the day, and sends it back. Use a laptop.', 'Offline day · Competitions · Day file'))
out.push(page(
  feat('Offline day, on the laptop', 'Admin, Offline day', 'On the laptop this page says <b>This is the venue laptop</b>. It shows the QR code for visitors and a <b>Download day file</b> button for each competition.', [
    'The laptop cannot start an offline day or load a file. Those buttons are online only.',
    'Download the day file when the competition is over, and keep it.',
  ], [I('venue/offline-day', 'Offline day, on the laptop', { h: 560, mm: 110 })]),
  feat('Everything else', 'Admin, the other pages', 'Competitions, staff, adjudicators, panels, fees, points and the rest work as online.', [
    'Changes to accounts made at the venue do not go back: passwords, staff accounts, two-step codes and photos. If a staff password was reset at the venue, reset it again online.',
  ], [I('venue/competitions', 'Competitions', { h: 520, mm: 110 })]),
))

// ================================================================================ 09 Athletes, coaches and teams
out.push(divider('Athletes, coaches and teams', 'Their own pages. Use your phone, on the venue Wi-Fi.', 'Account · Results'))
out.push(page(
  feat('Athlete', 'Sign in on the laptop\'s address', 'Athletes keep using their own page: their details, entries and results. They need to be on the venue Wi-Fi.', [
    'No email is sent at the venue. Notifications made at the venue are not sent back.',
  ], [I('venue-athlete/account', 'Account'), I('venue-athlete/results', 'Results')], true),
  feat('Team and coach', 'Sign in on the laptop\'s address', 'Teams and coaches see their dancers, entries and results. New entries and payments at the venue are made through the secretariat.', [], [I('venue-team/account', 'Team account')], true),
))

// ================================================================================ 10 Sending the day back
out.push(divider('Sending the day back', 'After the event, online. The admin loads the day file.', 'Download · Check · Load · What goes back'))
out.push(pageNew(`
<p class="num">After the event</p><h1>Send the day to the online server</h1>
<p class="lead">The day goes back as one file, not as a live sync. While the laptop holds the competition, the online server holds its day data still, so the file replaces that data. Nothing is merged and nothing can disagree.</p>
${step(1, 'Admin, on the laptop', 'Download the day file', 'Open the laptop\'s address, sign in as the admin, open <b>Offline day</b> and press <b>Download day file</b> for the competition. Keep the file.', [I('venue/offline-day', '', { h: 520, mm: 100 })])}
${step(2, 'Admin, online', 'Take a backup', 'The server already makes one after every change. Take one anyway before loading.')}
${step(3, 'Admin, online', 'Check the file', 'Open <b>Offline day</b>, press <b>Load day file</b> and choose the file. It first checks the file and shows what it holds. Nothing is kept yet.', [I('online/load-dialog', 'The check shows what the file holds', { mm: 82 })])}
${step(4, 'Admin, online', 'Load it', 'Press <b>Load it</b>. The competition\'s day data is replaced, the floor is cleared, the competition is released, and the rankings and points show on the website.', [I('online/loaded', 'Loaded, and the competition is online again', { h: 520, mm: 100 })])}
`))
out.push(pageNew(`
<h2 style="margin-top:0;border-top:0;padding-top:0">What goes back, and what does not</h2>
<table>
<tr><th>Goes back</th><th>Does not go back</th></tr>
<tr><td style="white-space:normal">Rounds, heats, every adjudicator's marks and signatures, tie decisions, results and ranking points</td><td>Changes to accounts: passwords, staff accounts, two-step codes, photos</td></tr>
<tr><td style="white-space:normal">Late entries, scratches, and the payments and entry requests handled at the venue</td><td>Athletes' notifications</td></tr>
<tr><td style="white-space:normal">Panels, PINs and the program as edited at the venue</td><td>Anything about other competitions in the copy</td></tr>
<tr><td style="white-space:normal">New teams, coaches, dancers and events made at the venue, and back numbers</td><td></td></tr>
</table>
<h2>Safeguards and limits</h2>
<ul>
<li><b>Same version.</b> The laptop and the online server must run the same version of BOSS. The load refuses a file from a different version and says so.</li>
<li><b>Only a handed-over competition.</b> A file is refused unless the competition was handed to a venue laptop, and only the admin can load it.</li>
<li><b>The pause is blunt on purpose.</b> While one competition is on a laptop, staff changes to every competition are paused online.</li>
<li><b>Do not register or pay online</b> for the competition between handing it over and loading the day. Importing a file replaces that competition's entries, payments and entry requests, so the online server refuses them.</li>
<li><b>If something does not look right</b> in the check, press <b>Cancel</b>. Nothing is changed. <b>Take back</b> releases the competition without loading anything.</li>
</ul>
`))

// ---- Help
out.push(pageNew(`
<p class="num">Help</p><h1>If something goes wrong</h1>
<p class="lead">Quick answers for the day. If these do not help, ask the admin.</p>
<h2>If the router stops</h2>
<p>Adjudicator phones keep their marks and send them when the Wi-Fi is back. Staff screens show <b>Offline</b> until then. Replace the router with the same settings.</p>
<h2>If the laptop stops</h2>
<p>On the spare laptop, set up BOSS as above (without a database copy), plug in the USB drive and double-click <b>restore.bat</b>. It starts from the newest backup. Give it the same address on the router. Phones then reload the page and carry on.</p>
<table>
<tr><th>Problem</th><th>What to check</th></tr>
<tr><td>A phone cannot open the address</td><td>It is on the router's Wi-Fi, not mobile data. Client isolation is off. The address is the laptop's reserved one. Port 80 is allowed through the laptop's firewall.</td></tr>
<tr><td>setup.bat says Docker is not running</td><td>Open Docker Desktop and wait until it says it is running.</td></tr>
<tr><td>Staff are asked for a two-step code that fails</td><td>The secret code differs from the online server's DATA_KEY, or the laptop's clock is wrong.</td></tr>
<tr><td>An adjudicator's PIN is refused</td><td>The laptop's date is wrong, or ADJUDICATOR_PIN_DAYS is too small for the competition's date. Print new cards if the admin changed the PINs.</td></tr>
<tr><td>The wrong competition is "current"</td><td>The laptop's clock decides it. Fix the clock, double-click stop.bat, then start.bat.</td></tr>
<tr><td>Loading says "different versions of BOSS"</td><td>Update the online server and the laptop to the same version.</td></tr>
<tr><td>The online server says changes are paused</td><td>A competition is with a venue laptop. Load its day file, or press Take back on the Offline day page.</td></tr>
<tr><td>Port 80 is already used</td><td>Set VENUE_PORT=8080 in deploy\\venue\\.env, and use http://&lt;address&gt;:8080 everywhere, including the PIN cards.</td></tr>
<tr><td>Visitors cannot see the public site</td><td>They must be on the venue Wi-Fi. Show them the QR code on the Offline day page.</td></tr>
</table>
`))

// ---------------------------------------------------------------------------------------------- page
const css = `
  @font-face { font-family: 'Manrope'; src: url('${APP}/frontend/src/assets/manrope-latin-wght-normal.woff2') format('woff2'); font-weight: 200 800; }
  @page { size: A4; margin: 20mm 18mm 22mm;
    @bottom-left { content: 'BOSS Offline Mode Manual'; font: 600 7.5pt 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #8a8379; border-top: 0.5pt solid #d8d3cb; padding-top: 3mm; vertical-align: top; }
    @bottom-right { content: counter(page); font: 600 7.5pt 'Manrope', sans-serif; color: #8a8379; border-top: 0.5pt solid #d8d3cb; padding-top: 3mm; vertical-align: top; } }
  @page full { size: A4; margin: 0; background: #0b0a09; @bottom-left { content: none; border: 0 } @bottom-right { content: none; border: 0 } }
  :root { --ink: #1a1613; --muted: #6b645c; --gold: #d9a520; --gold-text: #7a5a05; --line: #e6e2dc; --soft: #f7f5f1; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Manrope', 'Segoe UI', Arial, sans-serif; color: var(--ink); font-size: 9.6pt; line-height: 1.55; }
  .cover, .divider { page: full; height: 296.5mm; background: #0b0a09; color: #fff; position: relative; overflow: hidden; break-after: page; }
  .cover { padding: 24mm 22mm; display: flex; flex-direction: column; justify-content: space-between; }
  .cover img { width: 58mm; }
  .cover .kicker { font-size: 8.5pt; letter-spacing: .24em; text-transform: uppercase; color: var(--gold); font-weight: 700; margin: 0 0 7mm; }
  .cover h1 { font-size: 58pt; line-height: .98; margin: 0 0 10mm; letter-spacing: -0.04em; font-weight: 700; }
  .cover p { font-size: 12pt; line-height: 1.5; color: #cfc8bf; margin: 0; max-width: 118mm; }
  .cover .bar { width: 22mm; height: 1.2mm; background: var(--gold); margin-bottom: 9mm; }
  .cover p.roles { border-top: 1px solid #3a352f; padding-top: 5mm; font-size: 8.5pt; letter-spacing: .04em; color: #9a9288; line-height: 1.7; max-width: none; }
  .divider { padding: 24mm 22mm; display: flex; flex-direction: column; justify-content: flex-end; }
  .d-num { position: absolute; top: 12mm; right: 18mm; font-size: 170pt; font-weight: 800; letter-spacing: -0.06em; line-height: 1; color: #211d19; margin: 0; }
  .d-in { max-width: 150mm; }
  .d-bar { width: 22mm; height: 1.2mm; background: var(--gold); margin: 0 0 9mm; }
  .divider h1 { font-size: 54pt; margin: 0 0 6mm; letter-spacing: -0.04em; line-height: 1; color: #fff; }
  .d-who { font-size: 13pt; line-height: 1.45; color: #cfc8bf; margin: 0 0 14mm; max-width: 120mm; }
  .d-lines { font-size: 8.5pt; color: #8f877d; letter-spacing: .03em; line-height: 1.9; margin: 0; border-top: 1px solid #3a352f; padding-top: 5mm; }
  .toc { break-before: page; break-after: page; }
  .toc h1 { font-size: 30pt; margin-bottom: 8mm; }
  .toc a { display: flex; align-items: baseline; gap: 6mm; padding: 4mm 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
  .toc .tn { font-size: 8.5pt; font-weight: 700; color: var(--gold-text); width: 8mm; letter-spacing: .08em; }
  .toc .tt { font-size: 13pt; font-weight: 700; letter-spacing: -0.02em; width: 52mm; }
  .toc .td { flex: 1; color: var(--muted); font-size: 8.6pt; }
  .toc .tp { font-weight: 700; font-size: 10pt; font-variant-numeric: tabular-nums; }
  .num { font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: var(--gold-text); font-weight: 700; margin: 0 0 3mm; }
  h1 { font-size: 26pt; line-height: 1.08; margin: 0 0 3mm; letter-spacing: -0.03em; font-weight: 700; }
  .lead { color: var(--muted); font-size: 11pt; line-height: 1.5; margin: 0 0 8mm; padding-bottom: 6mm; border-bottom: 1px solid var(--ink); max-width: 150mm; }
  h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .12em; margin: 8mm 0 2.5mm; padding-top: 3mm; border-top: 1px solid var(--line); break-after: avoid; color: var(--ink); }
  h3 { font-size: 12pt; margin: 0 0 1mm; letter-spacing: -0.015em; }
  ol, ul { margin: 0 0 3mm; padding-left: 4.5mm; }
  li { margin-bottom: 1.2mm; padding-left: 1mm; }
  li::marker { color: var(--gold); font-weight: 700; }
  p { margin: 0 0 3mm; }
  b { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 6mm; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); border-bottom: 1px solid var(--ink); padding: 2.4mm 3mm 2.4mm 0; }
  td { border-bottom: 1px solid var(--line); padding: 2.2mm 3mm 2.2mm 0; vertical-align: top; }
  td:first-child { font-weight: 700; padding-right: 6mm; width: 46mm; }
  tr { break-inside: avoid; }
  .note { border: 1px solid var(--line); border-left: 1.2mm solid var(--gold); border-radius: 0 2mm 2mm 0; padding: 4mm 5mm; margin: 5mm 0; font-size: 9.4pt; background: var(--soft); }
  .feat { display: block; margin: 0 0 8mm; padding-top: 4.5mm; border-top: 1px solid var(--ink); break-inside: avoid; }
  .feat h2.ft { font-size: 14pt; text-transform: none; letter-spacing: -0.02em; margin: 0 0 1.2mm; padding: 0; border: 0; }
  .feat .where { font-size: 7.8pt; letter-spacing: .06em; text-transform: uppercase; color: var(--gold-text); font-weight: 700; margin: 0 0 3mm; }
  .feat .txt > p:not(.where) { color: #3d3730; }
  .feat.cell { display: grid; grid-template-columns: 66mm 1fr; column-gap: 10mm; align-items: start; }
  .feat.cell .imgs { display: flex; gap: 4mm; align-items: flex-start; justify-content: flex-end; }
  .feat.cell figure { flex: 0 0 50mm; min-width: 0; }
  .feat.cell figure .shot { width: 100% !important; }
  .feat:not(.cell) .imgs { display: flex; flex-wrap: wrap; gap: 5mm; margin-top: 4mm; align-items: flex-start; }
  figure { margin: 0; break-inside: avoid; }
  figcaption { font-size: 7.8pt; color: var(--muted); margin-top: 1.8mm; line-height: 1.35; }
  .shot { overflow: hidden; border: 1px solid #d4cfc6; border-radius: 1.6mm; background: #fff; max-width: 100%; }
  .shot img { display: block; width: 100%; }
  figure.phone .shot { border-radius: 4.5mm; border: 1.6px solid #2a2622; }
  .chain { display: grid; gap: 0; margin: 3mm 0 4mm; }
  .chain div { display: flex; gap: 4mm; padding: 2mm 0; border-bottom: 1px solid var(--line); align-items: baseline; }
  .chain div::before { content: '↓'; color: var(--gold-text); font-weight: 700; width: 4mm; }
  .chain div:first-child::before { content: '●'; }
  .chain b { width: 36mm; flex: 0 0 auto; }
  .chain span { color: var(--muted); }
  .step { display: grid; grid-template-columns: 12mm 1fr; padding: 4mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .sn { font-size: 13pt; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
  .sb { min-width: 0; }
  .sr { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .14em; color: var(--gold-text); font-weight: 700; margin: 0 0 .8mm; }
  .step h3 { font-size: 11.5pt; margin: 0 0 1mm; }
  .step p { margin: 0 0 2mm; color: #3d3730; }
  .step .imgs { display: flex; gap: 4mm; flex-wrap: wrap; align-items: flex-start; margin-top: 2mm; }
`

const toc = (pages) => `<section class="body toc"><p class="num">Contents</p><h1>Find your part</h1>
<p class="lead">Each section starts on a black page with its name, then explains every screen it has.</p>
${sections.map((s, i) => `<a><span class="tn">${s.n}</span><span class="tt">${s.name}</span><span class="td">${s.who}</span><span class="tp">${pages?.[i] || ''}</span></a>`).join('')}</section>`

const render = (pages) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BOSS Offline Mode Manual</title><style>${css}</style></head>
<body>
${out.join('').replace('@@TOC@@', toc(pages))}
</body></html>`

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p))
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? CHROME })
async function build(pages) {
  writeFileSync(join(DIR, 'offline-manual.html'), render(pages))
  const pg = await browser.newPage()
  await pg.goto(pathToFileURL(join(DIR, 'offline-manual.html')).href)
  await pg.waitForLoadState('networkidle')
  await pg.evaluate(() => document.fonts.ready)
  await pg.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await pg.close()
}

// The page of each divider, read back from the first pass
const FIND = `
import json, sys
import pypdfium2 as p
doc = p.PdfDocument(sys.argv[1]); want = json.loads(sys.argv[2]); res = []
texts = [doc[i].get_textpage().get_text_range() for i in range(len(doc))]
for w in want:
    res.append(next((i + 1 for i, t in enumerate(texts) if w in t and len(t) < 700), 0))
print(json.dumps(res))
`
await build(null)
const found = spawnSync('python', ['-I', '-c', FIND, PDF, JSON.stringify(sections.map((s) => s.who))], { encoding: 'utf8' })
await build(found.status === 0 ? JSON.parse(found.stdout) : null)
await browser.close()
copyFileSync(PDF, join(ROOT, 'docs', 'operations', 'OFFLINE_MODE_MANUAL.pdf'))
if (missing.length) console.warn('Missing screenshots:', missing.join(', '))
console.log('built', PDF)
