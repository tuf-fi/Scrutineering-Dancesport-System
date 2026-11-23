// Builds the BOSS user manual: manual.html and BOSS_User_Manual.pdf.
// Screenshots come from `node rehearsal/manual-shots.mjs`. Run this with `node build.mjs` from this folder (the app is read from ../../../Scrutineering-Dancesport-System, or BOSS_REPO).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIR = import.meta.dirname
// The app (logo, font, Playwright) is in the main repository, next to this one
const ROOT = process.env.BOSS_REPO ?? resolve(DIR, '..', '..', '..', 'Scrutineering-Dancesport-System')
const APP = pathToFileURL(ROOT).href
const { chromium } = createRequire(join(ROOT, 'package.json'))('playwright-core')

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

// A screenshot. Whole-page shots are cropped (y, h in their own pixels); dialogs and drawers are shown as they are.
function img(key, cap, o = {}) {
  const file = join(DIR, 'images', key + '.jpg')
  const { w, h } = jpegSize(file)
  const phone = key.startsWith('adjudicator/') || ['athlete', 'coach', 'team', 'public'].includes(key.split('/')[0])
  const fullPage = w === 1280 || w === 780
  const src = `images/${key}.jpg`
  let style, inner
  if (fullPage) {
    const y = o.y ?? 0
    const ch = Math.min(o.h ?? (phone ? 1450 : 620), h - y)
    const mm = o.mm ?? (phone ? 46 : 178)
    style = `width:${mm}mm;aspect-ratio:${w}/${ch}`
    inner = `<img src="${src}" style="margin-top:${(-y / w) * 100}%">`
  } else {
    const mm = o.mm ?? Math.min(178, phone ? (w / 780) * 46 : (w / 1280) * 178)
    style = `width:${mm}mm;max-height:${o.maxh ?? 120}mm`
    inner = `<img src="${src}">`
  }
  return `<figure class="${phone ? 'phone' : ''}"><div class="shot" style="${style}">${inner}</div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`
}
const I = img

// ---------------------------------------------------------------------------------------------- blocks
const esc = (s) => s
const list = (items) => (items?.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
let sectionNo = 0
const sections = []

function divider(name, who, lines) {
  sectionNo++
  sections.push({ n: String(sectionNo).padStart(2, '0'), name, who })
  return `<section class="divider"><div class="d-in"><p class="d-num">${String(sectionNo).padStart(2, '0')}</p><div class="d-bar"></div><h1>${name}</h1><p class="d-who">${who}</p>${lines ? `<p class="d-lines">${lines}</p>` : ''}</div></section>`
}
// One feature: its name, where to find it, what it does, and its screenshots
function feat(title, where, desc, bullets, imgs = [], phone = false) {
  return `<article class="feat ${phone ? 'cell' : ''}"><div class="txt"><h2 class="ft">${title}</h2>${where ? `<p class="where">${where}</p>` : ''}<p>${desc}</p>${list(bullets)}</div>${imgs.length ? `<div class="imgs">${imgs.join('')}</div>` : ''}</article>`
}
const page = (...blocks) => `<section class="body">${blocks.join('\n')}</section>`
const pageNew = (...blocks) => `<section class="body" style="break-before:page">${blocks.join('\n')}</section>`
const pageCols = (...blocks) => `<section class="body">${blocks.join('\n')}</section>`
const note = (t) => `<div class="note">${t}</div>`

// ---------------------------------------------------------------------------------------------- content
const out = []

out.push(`<div class="cover">
  <img src="${APP}/frontend/src/assets/logo.png" alt="BOSS">
  <div><div class="bar"></div><p class="kicker">Bicol Oragon Scruteneering System</p><h1>User<br>Manual</h1>
  <p>Every screen and every action, role by role, then a step-by-step guide to running a whole competition.</p></div>
  <p class="roles">Visitors · Athletes · Coaches · Teams · Adjudicators · Compere · Barker · Scrutineer · Chairperson · Secretariat · Admin</p>
</div>`)
out.push('@@TOC@@')

// ---- Start here
out.push(pageNew(`
<p class="num">Start here</p><h1>Who does what</h1>
<p class="lead">Find your role, then go to its section. Each section starts with a page showing the role's name, then explains every screen it has.</p>
<table>
<tr><th>Role</th><th>What you do</th><th>Sign in</th><th>Use</th></tr>
<tr><td>Visitor</td><td>Watch the program, results and standings.</td><td>None</td><td>Phone</td></tr>
<tr><td>Athlete</td><td>Keep your details and pay membership. Your team sends your entries.</td><td>Membership ID or email</td><td>Phone</td></tr>
<tr><td>Coach</td><td>Follow your athletes' results and entries.</td><td>Membership ID or email</td><td>Phone</td></tr>
<tr><td>Team</td><td>Follow your dancers, pay and send their entries.</td><td>Email</td><td>Phone</td></tr>
<tr><td>Adjudicator</td><td>Mark the dancers.</td><td>6-digit PIN</td><td>Phone</td></tr>
<tr><td>Compere</td><td>Read out who is called and who won.</td><td>Email</td><td>Laptop or screen</td></tr>
<tr><td>Barker</td><td>Line the competitors up and call them to be ready.</td><td>Email</td><td>Phone or tablet</td></tr>
<tr><td>Scrutineer</td><td>Run each round, check marks, publish results.</td><td>Email</td><td>Laptop</td></tr>
<tr><td>Chairperson</td><td>Watch the marks and confirm tie decisions in a final.</td><td>Email</td><td>Laptop</td></tr>
<tr><td>Secretariat</td><td>Enter dancers, give back numbers, plan the program.</td><td>Email</td><td>Laptop</td></tr>
<tr><td>Admin</td><td>Set up competitions, staff, adjudicators, fees and points.</td><td>Email</td><td>Laptop</td></tr>
</table>
<div class="signin"><div><h2 style="margin-top:0">Where to sign in</h2>
<ul>
<li><b>Staff</b> (admin, secretariat, scrutineer, chairperson, compere, barker): the website address followed by <b>/staff-access</b>. Your email is your role followed by <b>@boss2026.com</b>, such as <b>secretariat@boss2026.com</b>.</li>
<li><b>Adjudicators:</b> the same page, <b>Adjudicator</b> tab, or the website address followed by <b>/adjudicator</b>.</li>
<li><b>Athletes, coaches and teams:</b> press <b>Sign in</b> on the website and choose who you are. Athletes and coaches type their <b>membership ID</b> or their email; teams type their email.</li>
</ul>
${note('Everyone needs an internet connection: mobile data or Wi-Fi is fine. Staff and adjudicators are given their account by the admin.')}</div>
${I('athlete/signup', 'Athletes, coaches and teams create their own account.', { mm: 38, h: 1100 })}</div>
<article class="feat"><div class="txt"><h2 class="ft">Staff and adjudicator sign-in</h2><p class="where">The website address followed by /staff-access</p><p>One page for the staff and the adjudicators. Pick the <b>Staff</b> tab and type your email and password, or the <b>Adjudicator</b> tab and type your PIN. If two-step sign-in is on, a second step asks for the 6-digit code from your app.</p></div><div class="imgs">${I('auth/staff-access', '', { mm: 110, h: 800 })}</div></article>
`))

out.push(pageNew(`
<p class="num">Start here</p><h1>What every signed-in person has</h1>
<p class="lead">These work the same for everyone.</p>
<h2>Pop-up messages</h2>
<p>Short messages with a small sound appear on the screen when something needs you. Staff see them for new entry requests, new account links, membership payments and changes to names and birth dates. The admin hears the same ones as the secretariat. Athletes, coaches and teams see what the secretariat decided, and the same message is kept under <b>Notifications</b>. Adjudicators and the compere get none.</p>
<h2>Required fields and saving</h2>
<p>A field that must be filled in has a red <b>*</b> after its label. Buttons that save are switched off while the save is under way, so pressing twice never saves twice. On a phone the fields do not zoom in when you tap them.</p>
<h2>Your password</h2>
<p>Everyone who signs in with an email can change their own password. Athletes, coaches and teams can also <b>Sign out everywhere</b>. Staff can turn on <b>two-step sign-in</b>: after the password you type a 6-digit code from an app on your phone.</p>
<p><b>Forgot it?</b> On a sign-in page press <b>Forgot password?</b>, type the email of your account and press the button. We send a link that works once, for an hour (look in the spam folder too). It opens a page where you choose a new password; you are signed out everywhere when it is changed. Staff and adjudicators who are locked out ask the admin for a new password or PIN.</p>
<h2>Confirm your email</h2>
<p>A new athlete, coach or team account shows <b>Confirm your email address</b> on its pages. Open the link in the email we sent (or press <b>Send it again</b>). Until it is confirmed you cannot link your account to a record, enter events or pay.</p>
<h2>Your account and notifications (staff)</h2>
<p>Staff open <b>My account</b> by pressing their name at the top of the menu: change your name, and change your password under <b>Password</b>. <b>Notifications</b> at the bottom of the menu keeps the pop-up messages you were sent. The dot under it shows <b>Online</b>; if the connection drops it says so, and your screen catches up when it returns. <b>Sign out</b> is the last item.</p>
<div class="imgs">${I('admin/account', 'My account', { h: 700, mm: 110 })}${I('admin/notifications', 'Notifications', { h: 700, mm: 110 })}</div>
<h2>Phone and laptop</h2>
<p>The same pages fit any screen. On a phone, the menu is the three lines at the top right, and athlete, coach and team pages have a strip of links under the top bar.</p>
<h2>Safe by design</h2>
<p>Every action is checked against your role. A role that is not allowed to do something sees "Your account cannot do this."</p>
<h2>Addresses that do not exist</h2>
<p>If you open an address that does not exist, you are taken to the home page. On the staff pages you are taken to the staff sign-in.</p>
<h2>Pages with nothing to show</h2>
<p>A page with nothing to show says <b>No data available</b>, or says what is missing, for example "No program yet". <b>Couldn't load this</b> means the connection failed: press <b>Try again</b>.</p>
`))

// ================================================================================ VISITOR
out.push(divider('Visitors', 'No account needed. Use your phone.', 'Home · Competitions · Program · Bicol Athletes · Results · Standings · Privacy · Sign in'))
out.push(pageCols(
  feat('Home', 'Open the website', 'The front page of the website.', [
    'Upcoming events: a photo card for each competition with its date. Press one to open that competition.',
    'Latest competitions: press one to see its results.',
    'How to join: a short guide for newcomers.',
  ], [I('public/home', 'Top of the page'), I('public/home-join', 'How to join')], true),
  feat('Competitions', 'Menu: Competitions', 'Every competition in one list.', [
    'Search by name and filter by year.',
    'Each shows whether it is live, coming soon or finished.',
    'Press one to open it.',
  ], [I('public/competitions')], true),
  feat('A competition', 'Competitions, then a competition', 'Everything about one competition.', [
    'See its events and search or filter them by age group.',
    'Press an event to read its results.',
    'Press Program and running order to see the day.',
  ], [I('public/competition')], true),
  feat('Program', 'A competition, then Program and running order', 'What is happening on the floor.', [
    'See what is on the floor now and what is next.',
    'A coloured dot before each line number shows where it is: red finished, green on the floor, blue up next, grey not started. A key above the list explains the dots.',
    'See the whole running order with its number and start time. The entries column shows how many couples dance, and when a round is split into heats, how many are in each heat (for example 7 | 8).',
    'Type a back number to follow one competitor.',
    'Press Print to print the program or save it as a PDF.',
  ], [I('public/program')], true),
  feat('Live board', 'Menu: Live board', 'Follow a competition while it is on the floor.', [
    'On the day of a competition the Live board shows the round on the floor now and what comes next. Outside a competition day it says "No ongoing competition".',
    'If two competitions are on the same day, choose one. Each opens its own live board.',
    'Type a back number to follow one competitor.',
  ], [I('public/live', 'No competition today'), I('public/live-competition', 'On the day')], true),
  feat('Event results', 'Results or Competitions, then a competition, then an event', 'The published results of one event.', [
    'Results show only after the scrutineer publishes them. Until then you see "No results yet".',
    'When the organizer holds the results until the awarding, no event shows its results until the scrutineer reveals them all at once at the awarding. The ranking points and Standings wait too.',
    'If the adjudicators\' marks were not entered for an event (an older result that was imported, for example), the page shows only the placings.',
  ], [I('public/event-results')], true),
  feat('Bicol Athletes', 'Menu: Bicol Athletes', 'The athletes and couples who have a ranking entry.', [
    'Only those with points in a ranking event in Juvenile, Junior or Youth are listed. A Junior solo is listed only for a female dancer.',
    'Search by name or team and filter by age group.',
    'Press a name to open that dancer.',
  ], [I('public/athletes')], true),
  feat('A competitor', 'Bicol Athletes, then a name', 'One dancer or couple.', ['See their points, their results and their history.'], [I('public/competitor')], true),
  feat('Results', 'Menu: Results', 'The competitions that have been held.', [
    'Newest first. Search by name.',
    'Press a competition to see its events that have results, then press an event to read its results.',
    'A competition that has not been held yet is not listed here. Find it under Competitions.',
  ], [I('public/results'), I('public/results-competition', 'A competition opened from Results')], true),
  feat('Standings', 'Menu: Standings', 'Points from every approved result.', [
    'Choose the style, age group and class.',
    'Press a name to see that dancer\'s full record.',
    'Standings update as soon as the scrutineer approves a result.',
  ], [I('public/standings')], true),
  feat('Privacy notice', 'Bottom of every page', 'How details from entry forms are kept.', [], [I('public/privacy')], true),
  feat('Menu and sign in', 'The three lines at the top right', 'On a phone, the menu opens the same links. Sign in is here too.', [
    'Press Sign in, then choose Athlete, Coach or Team and press Continue.',
    'New here? Press Create an account.',
  ], [I('public/menu', 'The menu'), I('public/choose', 'Choosing who you are')], true),
))

// ================================================================================ ATHLETE
out.push(divider('Athletes', 'Competitors with their own account. Use your phone or laptop.', 'Account · Edit account · Membership · Payments · Results · Standings · Entries · Notifications · Password'))
out.push(pageCols(
  feat('Create your account', 'Sign in, choose Athlete, then Create an account', 'Make your own account with your name, a photo, an email and a password of at least 8 characters. Coaches and teams do the same, choosing Coach or Team.', [
    'A photo is required. Choose a square picture; it shows in your account and the menu.',
    'Use the same email as on your entry form, so you are not charged membership twice.',
    'We send a link to confirm your email. Open it to link your account, enter events and pay.',
    'Forgot your password? Press Forgot password? on the sign-in page. We email you a link to choose a new one.',
  ], [I('athlete/signup'), I('auth/forgot-password', 'Forgot password')], true),
  feat('Sign in', 'Sign in, then choose Athlete', 'Type your membership ID or your email, then your password.', [
    'Your membership ID (such as A-00001) is given when your first membership payment is confirmed. Until then, sign in with your email.',
    'The ID and the email both work from then on.',
  ], [I('athlete/signin')], true),
  feat('Account', 'Athlete menu: Account', 'Your home page.', [
    'Your picture, team and coach, your membership ID, and whether this year\'s membership is paid.',
    'Account information: date of birth, contact number, province and address. Only the secretariat sees these.',
  ], [I('athlete/account')], true),
  feat('Edit account', 'Athlete menu: Edit account', 'Change your details and picture.', [
    'Your picture can be replaced but not taken away: every account has one.',
    'Changing your team or coach is a request. The secretariat approves it, and your old team or coach stays until then.',
    'A new name, or a new date of birth when one is already on file, is a request too. Your current details stay until the secretariat approves it. Your first date of birth is saved straight away.',
  ], [I('athlete/edit')], true),
  feat('Membership', 'Athlete menu: Membership', 'Where your yearly membership stands.', [
    'Your team pays the membership, so there is nothing to send from this page.',
    'A membership covers the calendar year it is paid in and ends on December 31 of that year, whenever it is paid. Your membership ID is given with the first confirmed payment and never changes.',
    'It shows Paid, Waiting for the secretariat (your team sent a payment that is being checked), Not confirmed (with the reason; ask your team to send it again) or Not paid.',
  ], [I('athlete/membership')], true),
  feat('Payments', 'Athlete menu: Payments', 'Your payment history.', ['Each membership payment sent for you and what the secretariat decided.'], [I('athlete/payments')], true),
  feat('Results', 'Athlete menu: My results', 'How you placed.', ['Your results, by competition.'], [I('athlete/results')], true),
  feat('Standings', 'Athlete menu: My standings', 'Where you stand.', ['Your points and your place in your category.'], [I('athlete/standings')], true),
  feat('Entries', 'Athlete menu: Entries', 'What you are entered in.', ['The events you are entered in, by competition.'], [I('athlete/entries')], true),
  feat('Notifications', 'The bell at the top, or Notifications', 'What the secretariat decided.', [
    'New messages also appear as a pop-up with a sound.',
    'Press one to open the page it is about.',
  ], [I('athlete/notifications')], true),
  feat('Password', 'Athlete menu: Password', 'Change your password.', ['Press Sign out everywhere to sign out of every phone and laptop at once.'], [I('athlete/password')], true),
))

// ================================================================================ COACH
out.push(divider('Coaches', 'Follow your athletes. Use your phone or laptop.', 'Account · Link your coach · Edit account · Notifications · Dancers · Results · Standings · Entries · Password'))
out.push(pageCols(
  feat('Account', 'Coach menu: Account', 'Your home page.', [
    'Your details, picture and what you are linked to.',
    'Your membership ID (such as C-00001) and the dates you attended a Coaches Summit, once the secretariat has recorded them. The ID is given when your membership is first paid.',
    'You can sign in with the membership ID or your email, once your account is linked to your coach record.',
    'A new account is not linked yet. Every page that needs the link tells you so.',
  ], [I('coach/account')], true),
  feat('Link your coach', 'Coach menu: Link your coach', 'Connect your account to your coach record.', [
    'Pick your name from the list and send the request.',
    'Press Take back to cancel while it waits.',
    'The secretariat approves or turns it down. Until then you see nothing about athletes.',
  ], [I('coach/link', 'Shown here after the link was approved')], true),
  feat('Edit account', 'Coach menu: Edit account', 'Change your contact details and picture.', [
    'A new name, or a new date of birth when one is already on file, is a request. The secretariat approves it, and your current details stay until then.',
  ], [I('coach/edit')], true),
  feat('Notifications', 'The bell, or Notifications', 'What the secretariat decided.', ['Pop-ups arrive live, and are kept here.'], [I('coach/notifications')], true),
  feat('Dancers', 'Coach menu: Dancers', 'The athletes you coach.', ['Needs the link to be approved.'], [I('coach/dancers')], true),
  feat('Results', 'Coach menu: Results', 'How your athletes placed.', [], [I('coach/results')], true),
  feat('Standings', 'Coach menu: Standings', 'Where your athletes stand.', [], [I('coach/standings')], true),
  feat('Entries', 'Coach menu: Entries', 'The events your athletes are entered in.', ['A coach can look but cannot enter or pay. There are no entry or payment pages.'], [I('coach/entries')], true),
  feat('Password', 'Coach menu: Password', 'Change your password.', ['Press Sign out everywhere to sign out of every device.'], [I('coach/password')], true),
))

// ================================================================================ TEAM
out.push(divider('Teams', 'Dance teams, studios and clubs. Use your phone or laptop.', 'Account · Link your team · Edit account · Notifications · Dancers · Results · Standings · Entries · Membership · Payments · Enter events · My requests · Password'))
out.push(pageCols(
  feat('Account', 'Team menu: Account', 'Your home page.', ['Your team\'s details, picture and what you are linked to.', 'The number of dancers on your team.'], [I('team/account')], true),
  feat('Link your team', 'Team menu: Link your team', 'Connect your account to your team record.', [
    'Pick your team and send the request. Press Take back to cancel while it waits.',
    'The secretariat approves it under Account links.',
  ], [I('team/link')], true),
  feat('Edit account', 'Team menu: Edit account', 'Change the team\'s contact details and picture.', [], [I('team/edit')], true),
  feat('Notifications', 'The bell, or Notifications', 'What the secretariat decided.', ['Pop-ups arrive live, and are kept here.'], [I('team/notifications')], true),
  feat('Dancers', 'Team menu: Dancers', 'Your team\'s dancers and couples.', ['Search by name. Shows each dancer\'s back number.'], [I('team/dancers')], true),
  feat('Results', 'Team menu: Results', 'How your dancers placed.', [], [I('team/results')], true),
  feat('Standings', 'Team menu: Standings', 'Where your dancers stand.', [], [I('team/standings')], true),
  feat('Entries', 'Team menu: Entries', 'The events your dancers are entered in.', [], [I('team/entries')], true),
  feat('Membership', 'Team menu: Membership', 'Pay the year\'s membership for your athletes.', [
    'Membership is paid once a year for each athlete and ends on December 31 of that year, whenever it is paid.',
    'Choose the athletes, pay and send. The secretariat confirms it when the money arrives, and each athlete gets a membership ID with the first one.',
  ], [I('team/membership')], true),
  feat('Payments', 'Team menu: Payments', 'What has been paid and how.', [], [I('team/payments')], true),
  feat('Enter events', 'Team menu: Enter events', 'Send entries for your dancers.', [
    'Pick one of your dancers, the competition and the events.',
    'The fee and any warning show before you send.',
    'Pay and add a screenshot, then press Send entry.',
    'You can only enter dancers on your own team. Nothing is entered until the secretariat approves it.',
  ], [I('team/register')], true),
  feat('My requests', 'Team menu: My requests', 'Follow the entries you sent.', ['Waiting, Approved or Not approved (with the reason).', 'Press Take back to cancel a waiting one.'], [I('team/requests')], true),
  feat('Password', 'Team menu: Password', 'Change your password.', ['Press Sign out everywhere to sign out of every device.'], [I('team/password')], true),
))

// ================================================================================ ADJUDICATOR
out.push(divider('Adjudicators', 'You mark on your own phone. Nothing you mark can be lost.', 'Sign in · Waiting · Mark · Review · Sign · Submitted · Final placing'))
out.push(pageCols(
  feat('Sign in', 'The website address followed by /adjudicator', 'Type your 6-digit PIN, or scan the code on your PIN card with your phone\'s camera.', [
    'Your PIN works only around the competition date, on one phone at a time.',
    'Signing in on another phone signs this one out.',
  ], [I('adjudicator/pin'), I('adjudicator/pin-typed')], true),
  feat('Waiting', 'Appears after you sign in', 'Wait for the next round.', [
    'The round appears by itself when the scrutineer starts it. Keep the screen on and the phone charged.',
  ], [I('adjudicator/waiting')], true),
  feat('Mark: early rounds', 'Appears when a round starts', 'Tap the numbers of the dancers you want to go through to the next round.', [
    'Choose exactly the number shown at the top ("Mark an X for exactly 12").',
    'The counter at the bottom shows how many you have marked.',
    'Dancers are grouped by heat. Tap again to remove a mark.',
    'Under the numbers, a Syllabus box lists what may be danced in this event. Juvenile up to Junior I show a standard text unless the admin or secretariat wrote one for the event; older age groups show the box only when the event has its own text.',
  ], [I('adjudicator/mark', 'The round arrives'), I('adjudicator/mark-syllabus', 'The syllabus under the numbers'), I('adjudicator/mark-chosen', 'Numbers chosen')], true),
  feat('Review and sign', 'Press Submit', 'Check your choices, then sign.', [
    'Review your selection: check the numbers. They cannot be changed once sent.',
    'Press Final and submit, sign with your finger (Clear to sign again) and press Finalize.',
    'Your signature is printed on the scores sheet.',
  ], [I('adjudicator/review'), I('adjudicator/sign')], true),
  feat('Submitted', 'Appears after Finalize', 'Your marks are with the scrutineer.', ['The screen changes by itself when the next round starts.'], [I('adjudicator/submitted')], true),
  feat('Mark: the final', 'Appears when a final starts', 'Place every finalist, 1st to last, in each dance.', [
    'Tap a number to place it in the next free place.',
    'Use the arrows to move a placing up or down, or the cross to take it out.',
    'The counter shows how many are placed. Press Submit when everyone is placed, then sign as before.',
  ], [I('adjudicator/final'), I('adjudicator/final-placed')], true),
  feat('If something goes wrong', '', 'Your marks are saved on the phone first.', [
    'Connection drops: carry on and press Finalize. The phone sends your marks when it can, and the scrutineer can see it holds them.',
    'Page refreshed or browser closed: open the address again. Your marks come back.',
    'Phone dies: use your paper sheet and give it to the scrutineer, who types it in.',
    'Pressed Finalize by mistake: tell the scrutineer before they approve the round. Marks cannot be changed from the phone.',
    'PIN refused: ask the admin for a new one.',
  ]),
))

// ================================================================================ Compere
out.push(divider('Compere', 'The announcer. Use a laptop or a projector.', 'Announcer · Program · Live · Account'))
out.push(page(
  feat('Announcer', 'Sign in as compere: you land here', 'Your screen is made for the LED wall, in very large type. Press F for full screen: the controls fade out after a few seconds so the wall shows only the announcement.', [
    'Six views along the top: Next event, Recalled, Finalists, Results, Program and Live. Press the number keys 1 to 6, or click one. A view is dimmed until it has something to show.',
    'Space, Enter or the right arrow goes to the next announcement. Backspace or the left arrow goes back. Home and End jump to the first and last. "Up next" at the top right tells you what the next screen is before you press.',
    'Next event: the event going to the floor and, above it, the event after it, so the next couples can get ready. On the right, the heat and how many each adjudicator selects (or Final). Below are the back numbers. For a semi-final or a final each couple\'s name and team are shown with the number.',
    'Recalled: the numbers that go through to the next round, with names for a semi-final or final.',
    'Finalists: the couples in the final with their numbers, names and teams.',
    'Nothing shows until the scrutineer publishes a round. If the screen is empty, ask the scrutineer.',
  ], [I('compere/announcer', 'Next event', { h: 720 }), I('compere/recalled', 'Recalled', { h: 720 }), I('compere/finalists', 'Finalists', { h: 720 })]),
  feat('Results', 'Press 4', 'The places, read from last up to 1st.', [
    'A "Results" slide first, then each place in turn from last up. The list on the right fills in as you go.',
    'The top three stand as bars, with the winner\'s number, name and team shown large before it moves onto its bar.',
    'It shows only the event on screen, never another event\'s places.',
    'If the competition holds its results until the awarding, nothing about the final placings appears here until the scrutineer or chairperson reveals them. Then the Results slides for every event appear, in event order.',
  ], [I('compere/results', '', { h: 720 })]),
  feat('Program view', 'Press 5', 'What is on the floor, what is up next, and the lines around them.', [
    'On the floor and Up next sit side by side. When nothing is on the floor yet, Up next fills the top of the screen. A round counts as on the floor only once marking has started.',
    'Below them, the running order with its dots (red finished, green on the floor, blue up next, grey not started), each line\'s number and start time, and what happens in it, such as Select 6 or Rank 8.',
  ], [I('compere/program', '', { h: 720 })]),
  feat('Live view', 'Press 6', 'How many adjudicators have sent their marks for each round on the floor, while you wait for the results.', [
    'One round on the floor fills the screen. When several rounds are on the floor at once they sit side by side (five fit on one screen), each with its own count and progress bar.',
    'It never shows the marks themselves.',
    'When the results are published while this view is up, the screen moves to the Results slide by itself.',
  ], [I('compere/live', '', { h: 720 })]),
  feat('Account', 'Your name at the top right', 'Change your name and password. Turn on two-step sign-in.', ['The compere cannot change anything about the competition.'], [I('compere/account', '', { h: 560 })]),
))

// ================================================================================ BARKER
out.push(divider('Barker', 'You line the competitors up. Use a phone or a tablet.', 'On the floor · Up next · Account'))
out.push(page(
  feat('Board', 'Sign in as barker: you land here', 'Who is on the floor, and who to call next.', [
    'On the floor now: the round being danced, with each competitor\'s back number and names, by heat.',
    'Next event: the next round in the running order, with the back numbers and names to call and line up.',
    'The board updates by itself when the scrutineer starts a round. It needs the running order: ask the secretariat to generate it if nothing shows.',
    'A competitor without a back number shows a dash. Ask the secretariat to assign one.',
    'The barker only reads. Nothing can be changed from this screen.',
  ], [I('barker/board', 'On the floor', { h: 900 })], true),
  feat('Up next', 'Barker menu: Up next', 'The next event only, to line the competitors up early.', [
    'The same list as Next event on the board, on a screen of its own, so you can keep it open while the round on the floor is danced.',
  ], [I('barker/next', '', { h: 900 })], true),
  feat('Account', 'Menu: Account', 'Change your name and password. Turn on two-step sign-in.', ['The admin makes the barker\'s account under Staff accounts.']),
))

// ================================================================================ SCRUTINEER
out.push(divider('Scrutineer', 'You run every round. Use a laptop and keep it open all day.', 'Rounds · Heats · Program · Advancement · Live board · Paper marks · Recall · Results · Certificates · Printouts · Security'))
out.push(page(
  feat('Rounds', 'Menu: Rounds', 'See where the competition is and every round still to run.', [
    'Plan rounds: press once so every event with entries gets its rounds.',
    'Start: puts the round on the floor and on the adjudicators\' phones.',
    'A round will not start while entries are unpaid. The message tells you how many.',
    'Take off the floor: use it for a wrong round. Possible until an adjudicator has submitted.',
    'The black box shows the round on the floor, how many adjudicators have submitted, and shortcuts to Live board, Heats, Recall and Results.',
  ], [I('scrutineer/rounds', 'The round on the floor and the list of rounds', { h: 700 }), I('scrutineer/start-blocked', 'A round will not start while entries are unpaid', { h: 420, y: 0 })]),
  feat('Heats', 'Menu: Heats', 'Split a big round into groups that dance together.', [
    'Choose the round and how many dancers per heat.',
    'Split evenly shares them out. Use the heat box on a row to move one dancer.',
    'Press Save heats. The program and its printout then show the split of every round, for example 12 | 12 | 8.',
    'The admin and the secretariat have the same Heats page, so the heats can be set before the day.',
    'Merge heats: everyone in the first heat joins the second. Swap couples: two couples trade heats. Move a heat: it is danced at a new position and the others shift. Nothing is kept until you press Save heats.',
    'Changing heats while a round is on the floor asks you to confirm, because the adjudicators\' phones change at once. Their marks stay.',
    'Redance a heat (only you, only while the round is being marked or reviewed): choose the heat and give the reason. Adjudicators who already sent their marks mark that heat once more; the other heats keep their marks. In a final, every finalist is placed again. The reason is kept with the cleared marks, and the heats cannot change until every adjudicator has marked it again.',
  ], [I('scrutineer/heats', '', { h: 640 }), I('scrutineer/heats-split', 'Heats split into twelves', { h: 640 }), I('scrutineer/heat-merge', 'Merge heats', { maxh: 110 }), I('scrutineer/heat-swap', 'Swap couples', { maxh: 110 }), I('scrutineer/heat-move', 'Move a heat', { maxh: 110 }), I('scrutineer/redance', 'Redance a heat', { maxh: 110 })]),
  feat('Program, Schedule and Panels', 'Menu: Program, Schedule, Panels', 'The running order and who marks each event, the same screens the secretariat uses.', [
    'Program: every round, break and the awarding with its start time, how many couples dance (and the heats of each round) and what is done in it, such as Select 6 or Rank 8. Drag a line to move it.',
    'Schedule sets the order of the events. Panels shows which adjudicators mark each event.',
  ], [I('scrutineer/program', '', { h: 640 })]),
  feat('Advancement', 'Menu: Advancement', 'How many couples dance in each round, by the number of entries.', [
    'Each row says: from this many entries, which rounds an event dances (Round 1, Round 2, Quarter-final, Semi-final, Final) and how many couples go through each. All means every couple dances the first round.',
    'The table gives every event its rounds when you press Plan rounds. Changing a row changes the rounds for every event of that size.',
    'To change one event only, open Schedule and edit that event\'s rounds. This is possible until the event has started.',
  ], [I('scrutineer/advancement', '', { h: 640 })]),
  feat('Live board', 'Menu: Live board', 'Watch each adjudicator\'s phone.', [
    'Each adjudicator goes from Waiting to Submitted.',
    'A phone silent for 20 seconds is flagged. "Marks saved on the phone, not sent yet" means the phone has them and is waiting for a connection.',
    'When everyone is in, press Review the recall (or Review the results).',
  ], [I('scrutineer/live', 'During the round', { h: 640 }), I('scrutineer/live-complete', 'Everyone has submitted', { h: 640 })]),
  feat('Paper marks', 'Menu: Paper marks', 'Type in an adjudicator\'s paper sheet when their phone could not send.', [
    'Choose the round and the adjudicator. Only adjudicators who have not submitted are listed.',
    'Tap exactly what is on the sheet: an X for each couple, or every finalist in order in a final.',
    'Press Submit, check the numbers against the sheet and press Enter marks.',
    'They count like marks from the phone, and the adjudicator shows as submitted on the Live board.',
    'A sheet cannot be changed once entered. Only while a round is being marked or reviewed. The chairperson does not have this page.',
  ], [I('scrutineer/paper-marks', '', { h: 330, mm: 130 }), I('scrutineer/paper-sheet', 'The sheet typed in', { y: 250, h: 640, mm: 130 }), I('scrutineer/paper-confirm', 'Check, then Enter marks')]),
  feat('Recall', 'Menu: Recall', 'See who goes through to the next round.', [
    'X marks per dancer and the cut-off for the next round.',
    'Couples level with the last couple to be recalled all go through, so the number recalled can be higher than the recall number (here 15 go through for a recall of 12). There is no tie to decide and nothing for the chairperson to confirm.',
    'Only a tie in a final needs a decision. See Results.',
  ], [I('scrutineer/recall', 'Couples level on the cut-off all go through', { h: 640 })]),
  feat('Results', 'Menu: Results', 'Each adjudicator\'s marks and how the round works out.', [
    'See every adjudicator\'s marks, the X total and the places. In a final you also see the skating tables.',
    'Tie in a final: when the marks cannot separate two couples, a Tie in the final box says which couples share a place. Choose Keep the shared place, or settle it with a dance-off (for 1st place) or a tie-break (for any other place) and give each couple its place in it, then press Propose decision. The chairperson confirms. The final cannot be approved until they do.',
    'Approve results: locks the marks, saves the result, adds the ranking points and takes a backup.',
    'Publish results: makes the result public and shows it to the compere.',
    'When the competition holds its results until the awarding, a bar at the top says how many finals are published and waiting. Publishing keeps them private. Press Reveal results at the awarding to make every event public at once, on the website and the compere screen. Only the scrutineer and the chairperson can reveal, and it cannot be undone.',
    'Print summary prints the round.',
  ], [I('scrutineer/results', '', { h: 640 }), I('scrutineer/final-tie', 'A tie in a final', { h: 520 }), I('scrutineer/final-tie-order', 'Settled with a dance-off', { h: 520 }), I('scrutineer/final-tie-proposed', 'Proposed, waiting for the chairperson', { h: 520 }), I('scrutineer/approve-confirm', 'Approve'), I('scrutineer/publish-confirm', 'Publish'), I('scrutineer/results-hold', 'When results are held: the bar at the top shows how many finals are waiting', { h: 330 }), I('scrutineer/reveal-confirm', 'Reveal results asks first')]),
  feat('Certificates', 'Menu: Certificates', 'Design how the printed certificates look. One layout serves every competition; the admin has the same page.', [
    'The page shows a preview with sample names. Click a line to edit it, or drag it to move it (the arrow keys nudge it).',
    'Page: paper size, and Landscape or Portrait.',
    'Line: choose a line (organizer, title, name, team, place, event, date and so on). Wording is the text printed; it can include a detail that changes for each couple, such as the name or the place. Empty hides the line. Also set the font, the size, Bold, Italic, Capitals and the color.',
    'Signatures: each signature block has a title (for example Organizer) and a name. An empty name uses the competition\'s organizer, and the chairperson signs with their own signature. Add signatory adds another block; its signature picture and its name can be dragged on their own.',
    'Import layout: use a designed certificate as the background (JPG, PNG, WebP or the first page of a PDF, up to 10 MB). Reset goes back to the built-in layout.',
    'Press Save layout to keep your changes.',
    'To print: open All printouts, choose the event and press Certificates. There is one for each placed finalist, printed from last place to 1st, once the final is approved. Press Print, or Download PDF.',
  ], [I('scrutineer/certificates', '', { h: 760 }), I('scrutineer/print-certificates', 'Printed certificates', { y: 60, h: 900 })]),
  feat('Printouts', 'Print summary, or All printouts', 'Paper sheets for any event or round.', [
    'Program, heat list, list of dancers going through (the qualified list), scores sheet, final results (with room to sign), certificates and blank mark sheets.',
    'Press Print on the sheet, or Back to return.',
  ], [I('scrutineer/print-index', '', { h: 560 }), I('scrutineer/print-recall', 'List of dancers going through', { y: 80, h: 800 })]),
  feat('Scores sheet, final results and blank sheets', 'All printouts', 'Marks of every adjudicator on paper, the final results to sign, and empty sheets for a backup.', [], [I('scrutineer/print-scores', 'Scores sheet', { y: 60, h: 800 }), I('scrutineer/print-results', 'Final results', { y: 60, h: 800 }), I('scrutineer/print-blank', 'Blank mark sheets', { y: 60, h: 800 })]),
  feat('Security', 'Menu: Security', 'Turn on two-step sign-in and change your password.', [
    'Backup warning: a red note at the top of the screen means a backup folder failed. Tell the admin. Results are still saved.',
    'You cannot confirm your own tie proposal. The chairperson does that.',
  ], [I('scrutineer/security', '', { h: 460 })]),
))

// ================================================================================ CHAIRPERSON
out.push(divider('Chairperson', 'You oversee the scoring. Use a laptop.', 'Live board · Recall · Results · Printouts · Security'))
out.push(page(
  feat('What you can see', 'Menu: Live board, Recall, Results', 'You see the scrutineer\'s screens and marks, but you cannot enter marks.', [
    'You cannot start, approve or publish a round.',
    'You can press Reveal results on the Results page at the awarding, when the competition holds its results.',
    'Every decision you make is stored with your name and the time.',
  ], [I('chairperson/live', 'Live board: who has submitted', { h: 640 })]),
  feat('Recall', 'Menu: Recall', 'See who goes through. There is nothing to confirm here.', [
    'Couples level with the last couple to be recalled all go through, so a tie at the cut-off needs no decision.',
  ], [I('chairperson/results', 'Results: check the places and the marks before they are published', { h: 640 })]),
  feat('Confirm a tie in a final', 'Menu: Results', 'If two couples still share a place, Results shows Tie in the final.', [
    'The scrutineer proposes keeping the shared place, or a dance-off (1st place) or tie-break (other places) order. The box says "Waiting for the chairperson".',
    'Check the proposal against the dance-off or tie-break result, then press Confirm tie decision. Afterwards it says who confirmed it.',
    'The final cannot be approved until you do. You cannot confirm your own proposal, and the scrutineer cannot confirm theirs.',
  ], [I('chairperson/final-tie-confirm', 'The proposal to confirm', { h: 520 }), I('chairperson/final-tie-confirmed', 'After confirming', { h: 520 })]),
  feat('Printouts and Security', 'Print summary; Menu: Security', 'The same printouts as the scrutineer, and the same security page.', [], [I('chairperson/security', '', { h: 460 })]),
))

// ================================================================================ SECRETARIAT
out.push(divider('Secretariat', 'Entries, back numbers and the order of the day. Use a laptop.', 'Events · Teams · Coaches · Athletes · Entry requests · Account links · Profile changes · Late entries · Schedule · Heats · Program · Panels · Printouts · Security'))
out.push(page(
  feat('Events', 'Menu: Events', 'Every event in the competition and how many entries it has.', [
    'Add event, edit and delete. Set the age group, class, style, dances, solo or couple.',
    'Set the Kind so it is priced and checked correctly: Beginners, Ranking, Inter-school, or Closed to a province.',
    'Syllabus is optional: write what may be danced in this event and the adjudicators see it under their numbers. Empty uses the standard text for Juvenile up to Junior I. It cannot be changed once the event has started.',
    'Search, filter by age group and choose the competition.',
    'Press an event to see its entries.',
  ], [I('secretariat/events', '', { h: 560 }), I('secretariat/event-add', 'Add event')]),
  feat('An event', 'Events, then an event', 'The entries of one event.', [
    'Scratch a dancer who withdraws. Restore undoes it before the event starts.',
    'Payment column: Unpaid, For checking, Rejected or paid.',
    'Print the Heat list and the Recall list, or press All printouts.',
  ], [I('secretariat/event', '', { h: 640 })]),
  feat('Enter in events', 'Athletes, the list icon on a row', 'Put a dancer into events and record what was paid.', [
    'Choose the competition and tick the events from the entry form. The fee shows as you tick.',
    'Choose how it was paid: cash, GCash, Maya, bank, or Not paid yet. Teams usually pay after your summary.',
    'If the coach has not paid this year, you can add the coach\'s membership and the Coaches Summit to the payment.',
    'A couple dances in the age group of its older partner, or an older one, never a younger one: a Junior and a Youth dancer are a Youth couple, so a Junior event is refused. A solo dances only in its own age group. A refused entry says the age does not match the event\'s age requirement.',
    'Red notes are warnings, not blocks: a beginner in a non-beginner event, or an entry after the deadline.',
    'Press Enter.',
  ], [I('secretariat/enter-in-events'), I('secretariat/back-number', 'Setting one back number')]),
  feat('Teams', 'Menu: Teams', 'The teams on the entry forms.', ['Add, edit and delete. A team that still has competitors cannot be deleted, and the same team name cannot be added twice.'], [I('secretariat/teams', '', { h: 560 }), I('secretariat/team-add')]),
  feat('Coaches', 'Menu: Coaches', 'The coaches on the entry forms.', ['Add, edit and delete. Enter the year their membership and the Coaches Summit were paid.', 'The membership ID (C-00001) is given automatically when the coach\'s membership is first recorded or paid. It cannot be typed in or changed.', 'Summits attended: add the date of each Coaches Summit the coach attended, and remove one added by mistake. The newest shows first.', 'Only an admin can change a coach\'s name. The same coach name cannot be added twice.'], [I('secretariat/coaches', '', { h: 560 }), I('secretariat/coach-add')]),
  feat('Athletes', 'Menu: Athletes', 'Every athlete in one list, paid or not: athletes with an account, athletes you added, and dancers who are only on an entry form.', [
    'Add athlete: a dancer and partner (leave the partner empty for a solo), team, province, coach and the membership paid for. Each dancer\'s date of birth, contact number, email and address are required; gender is optional and is used for the Solo Junior Female entries on the Bicol Athletes list. The same dancers cannot be added twice to one team.',
    'Import CSV: add many from a CSV file (in Excel, Save As, CSV; an .xlsx file is not read). One row for each entry, with these columns in this order: Dancer, Partner (empty for a solo), Team, Province, Coach, Beginner (yes or no), then for the dancer and again for the partner: Date of birth, Contact no., Email, Address. A first row of titles is skipped. Only the first three are needed. The team and the coach must already be added.',
    'Assign back numbers: gives every entry a number. In an athlete\'s side panel, Set back number sets one by hand. An athlete in more than one entry (a solo and a couple) is asked which one.',
    'Filter by paid or not paid, competition, event and team; the line under the filters counts everyone.',
    'Payment waiting: check it against the money received, then press the tick to confirm. Their membership is then recorded for the year, and they get their membership ID (A-00001) with the first one.',
    'The Membership ID column shows it, and you can search by it.',
    'Press a row to see the athlete\'s account and payment details in the side panel.',
    'Press the cross to turn a payment down. You must give a reason, and the athlete sees it.',
    'The key gives a new password and the bin deletes an account.',
  ], [I('secretariat/athletes', '', { h: 560 }), I('secretariat/athlete-add', 'Add athlete', { maxh: 150 }), I('secretariat/import', 'Import')]),
  feat('Entry requests', 'Menu: Entry requests', 'Entries sent online by teams.', [
    'Newest first, each with its date, sender, events and fee. A pop-up announces each new one.',
    'Press the small picture to see the payment screenshot and check it against the money received.',
    'The tick approves it: the dancer is entered and the payment recorded. The sender is told.',
    'The cross turns it down. You write the reason, and the sender reads it and can send again.',
    'A decided request cannot be decided again.',
  ], [I('secretariat/entry-requests', '', { h: 480 }), I('secretariat/request-turn-down', 'Turning one down'), I('secretariat/request-approved', 'Approved', { h: 480 })]),
  feat('Account links', 'Menu: Account links', 'Coaches and teams asking to be linked to their record.', [
    'See who is asking and which record they want.',
    'Press the tick to link them, or the cross to turn them down. Check that the person really is that coach or team.',
  ], [I('secretariat/account-links', '', { h: 520 })]),
  feat('Profile changes', 'Menu: Profile changes', 'An athlete or coach asking to change their name, date of birth, team or coach.', [
    'Each row shows the current details next to what they ask for. Athletes are listed first, coaches below.',
    'Press the tick to approve it: everything asked for is applied and the person is told. Press the cross to turn it down. You must give a reason, and they read it.',
    'Until you approve it, their current details stay. Athletes and coaches cannot change a name or birth date on file themselves; the admin can correct one directly.',
  ], [I('secretariat/profile-changes', '', { h: 520 })]),
  feat('Late entries', 'Menu: Late entries', 'Dancers added after the entries closed.', [
    'Add, edit or delete a late entry. Say whether it was paid in cash at the venue. A late entry that has not paid cannot dance.',
    'Cash payments tab: mark a team\'s unpaid or rejected payment as paid at the venue.',
  ], [I('secretariat/late-entries', '', { h: 520 }), I('secretariat/late-entry-add'), I('secretariat/cash-payments', 'Cash payments', { h: 520 })]),
  feat('Schedule', 'Menu: Schedule', 'The order the events are danced in.', ['Use the arrows to move an event up or down.'], [I('secretariat/schedule', '', { h: 620 })]),
  feat('Heats', 'Menu: Heats', 'Split a big round into groups that dance together.', [
    'Choose the round and how many dancers go in each heat, press Split evenly, or move one dancer with the heat box on its row, then press Save heats.',
    'The program and its printout show each round\'s heats, for example 7 | 8. The scrutineer and the admin have the same page.',
  ], [I('secretariat/heats', '', { h: 640 })]),
  feat('Program', 'Menu: Program', 'The running order with start times.', [
    'Press Generate to build it from the events: every round, break and the awarding.',
    'Columns: Time, Sequence no., Event, Round, No. of Entries (with the heats of each round), Action (Select 6 or Rank 8), Adjudicators, Min and Status.',
    'Set Starts at to the first start time.',
    'Add break puts in a break. Use the arrows, pencil and bin on a line to move, edit or remove it.',
    'Add missing rounds fills in rounds added later. Print prints it on A4 portrait, with a sequence number on every line and the heats of each round.',
    'Adjudicators shows who marks each round as a set: Set A, Set B and so on, one name for each different group of adjudicators, in the order they first appear. When only some of the panel mark a round (5 of 7, say), press Rotate adjudicators and enter how many, or use the adjudicators icon on a round to choose them. Only those adjudicators mark that round, and it cannot change once the round has started.',
    'Visitors see the program on the website.',
  ], [I('secretariat/program-empty', 'Before it is generated', { h: 420 }), I('secretariat/program', 'After pressing Generate', { h: 640 }), I('secretariat/program-break', 'Add break')]),
  feat('Panels', 'Menu: Panels', 'Which adjudicators mark each event.', [
    'A grid of events by adjudicator. Tick the adjudicators for each event; the Panel column names each different group as a set (Set A, Set B and so on).',
    'The admin makes the same choices under Adjudicators and panels. A panel cannot change once the event has started.',
  ], [I('secretariat/panels', '', { h: 640 })]),
  feat('Printouts', 'All printouts', 'Heat lists, recall lists, score sheets and blank sheets, plus the program.', [], [I('secretariat/print-index', '', { h: 560 }), I('secretariat/print-heats', 'Heat list', { y: 60, h: 700 })]),
  feat('Security', 'Menu: Security', 'Turn on two-step sign-in and change your password.', ['Do turn on two-step sign-in: this role records payments and resets accounts.', 'You cannot create competitions or staff, change fees or run rounds.'], [I('secretariat/security', '', { h: 460 })]),
))

// ================================================================================ ADMIN
out.push(divider('Admin', 'You set the system up. Use a laptop.', 'Competitions · Past competition · Kinds, classes and age groups · Adjudicators and panels · Event list · Results · Points table · Payments · Fees · Staff accounts · Security · plus every secretariat screen'))
out.push(page(
  feat('Competitions', 'Menu: Competitions', 'Create and manage the competitions.', [
    'New competition: name, date, organizer, venue and a card photo (required). The date cannot be before today: a finished competition cannot be added or moved into the past. A competition already held can still have its other details corrected.',
    'Executor (optional) is who runs the scoring; it is printed as the Executor on result sheets. Empty uses the organizer.',
    'Entries close and Fees due are optional. Later entries are flagged to the secretariat.',
    'Hold the results until the awarding: finals are published as usual but stay private. Guests, Standings and the compere see nothing until the scrutineer or chairperson presses Reveal results. Leave it off to show each result as soon as it is published.',
    'Search, filter by year, edit and delete. A competition with events cannot be deleted.',
  ], [I('admin/competitions', '', { h: 560 }), I('admin/competition-new')]),
  feat('Past competition', 'Menu: Past competition', 'Add a competition that was held before the system existed, so its results, ranking points and athlete history show like any other.', [
    'Press Download template. It is an Excel file (.xlsx) with a Read me sheet and one sheet for each kind of row listed below. Fill it in and keep the column titles as they are: sheets and columns are found by name, in any order. Only .xlsx files are read.',
    'Press Import previous record and choose the file, then Choose the card photo (every competition has one).',
    'The system checks the whole file first and keeps nothing yet. Each thing to fix is listed with its sheet and row. A warning does not stop the import: it means the marks work out a different placing from the printed one, and the printed placing is kept.',
    'When the list is clean, press Import it. All of the competition is saved, or none of it.',
    'Dancers are matched to the ones already in the system by team and name, so their history joins up. Adjudicators are matched by name, and a new one gets a free letter. Imported dancers get no back number.',
    'The age groups and classes used in Events must already exist under Kinds, classes and age groups. Only the admin can import.',
  ], [I('admin/past-competition', '', { h: 640 })]),
  `<table class="xl">
<tr><th>Sheet</th><th>One row is</th><th>Columns</th></tr>
<tr><td>Competition</td><td>The competition (one row)</td><td>name, date (year-month-day, such as 2024-03-16), venue, organizer, executor (optional)</td></tr>
<tr><td>Events</td><td>One event</td><td>event_no, age_group, class, discipline (Latin or Standard), dances (with commas, such as waltz, tango), solo (yes or no), kind, province, uses_points (yes or no). The last three are optional.</td></tr>
<tr><td>Competitors</td><td>One couple or solo dancer</td><td>back_number, name_1, name_2 (empty for a solo), team, birth_date (optional)</td></tr>
<tr><td>Entries</td><td>Who entered which event (optional)</td><td>event_no, back_number. Dancers named in Rounds, Marks or Placings are entered by themselves.</td></tr>
<tr><td>Adjudicators</td><td>One adjudicator</td><td>letter, name</td></tr>
<tr><td>Rounds</td><td>One dancer in one round</td><td>event_no, round, back_number. The round is round_1, round_2, quarter_final, semi_final or final. Needed for every event that has marks.</td></tr>
<tr><td>Marks</td><td>One mark</td><td>event_no, round, adjudicator (the letter), back_number, dance, mark. The mark is X before the final and a placing (1, 2, 3 and so on) in the final. Every dance has its own rows.</td></tr>
<tr><td>Placings</td><td>One printed final placing (optional)</td><td>event_no, back_number, place. An event with only placings shows its results without the round detail.</td></tr>
</table>
<p class="xn">Dances are written as samba, cha_cha_cha, rumba, paso_doble, jive, waltz, tango, viennese_waltz, foxtrot or quickstep. Each adjudicator marks the same number of X in every dance of a round, and gives every finalist a different placing in each dance.</p>`,
  feat('Kinds, classes and age groups', 'Menu: Kinds, classes and age groups', 'The kinds of event, the classes and the age groups the system uses. Three tabs: Event kinds, Classes and Age groups.', [
    'Classes (for example E1, D, C, B) are listed with how many events use each and which events they are. New class adds one; the pencil edits and the bin deletes. A class that events use cannot be deleted. Choose a competition to see only its events.',
    'Kinds set which disciplines their events are danced in and who may enter, for example Beginners only or Closed to one province. Age groups set a name, how it is printed and the years of birth the group covers.',
    'A change never rewrites the past. Once an event in an age group has started, saving a change makes a new version and keeps the old one for those events, their results and sheets. Events still to run, and competitors, move to the new version.',
    'Standings add points earned under the old version to the new one. A group or kind that events use cannot be deleted.',
    'Age groups go by year of birth. A couple dances in the group of its older partner or an older one. You can add groups such as Under 21 or Senior.',
  ], [I('admin/categories', 'Event kinds', { h: 560 }), I('admin/categories-classes', 'Classes', { h: 700 }), I('admin/categories-ages', 'Age groups', { h: 560 })]),
  feat('Adjudicators', 'Menu: Adjudicators and panels', 'The adjudicators and their PINs.', [
    'Add adjudicator: name, a photo (required) and a letter, A to J. Edit or delete with the icons on the row. Adjudicators can be added before any competition exists; only their PINs need one.',
    'Choose a competition to see each adjudicator\'s PIN for it. The pencil edits, the key makes a new PIN, the arrow signs that phone out at once.',
  ], [I('admin/adjudicators', '', { h: 600 }), I('admin/adjudicator-add')]),
  feat('PIN cards', 'Adjudicators, tick names, then Print PIN cards', 'A card for each adjudicator with a 6-digit PIN and a QR code.', [
    'Tick the adjudicators (or the box at the top for all) and press Print PIN cards.',
    'Hand the cards out privately. A new PIN signs that adjudicator\'s phone out.',
  ], [I('admin/pin-select', '', { h: 480 }), I('admin/pin-cards', '', { y: 40, h: 700 })]),
  feat('Panels', 'Adjudicators and panels, Panels tab', 'Choose which adjudicators mark each event.', [
    'A grid of events by adjudicator. Tick the adjudicators for each event; the Panel column names each different group of adjudicators as a set (Set A, Set B and so on).',
  ], [I('admin/panels', '', { h: 640 })]),
  feat('Event list', 'Menu: Event list', 'Every event with the back numbers and the athletes entered, to give out or print.', [
    'Search by athlete name, team or back number. Filter by event, and choose the competition when there is more than one.',
    'Download saves the list as a PDF. Print opens a printout with the same filters.',
  ], [I('admin/event-list', '', { h: 640 }), I('admin/event-list-print', 'Printout', { y: 40, h: 700 })]),
  feat('Results', 'Menu: Results', 'Read every adjudicator\'s marks of any round, with the same table the scrutineer sees.', [
    'Choose the round. The status at the top right says whether it is still being marked, waiting for review, approved or published.',
    'Print summary prints the round. The admin cannot start, approve or publish a round; the scrutineer does that.',
  ], [I('admin/results', '', { h: 760 })]),
  feat('Certificates', 'Menu: Certificates', 'The certificate layout, the same page as the scrutineer\'s Certificates. Design it once, before the day.', [
    'Paper and orientation, each line\'s wording, font, size, style and color, the signature blocks (a title, a name and an uploaded signature picture) and a designed background.',
    'Press Save layout. See Certificates in the Scrutineer section for how to use it and how to print.',
  ], [I('admin/certificates', '', { h: 760 })]),
  feat('Offline day', 'Menu: Offline day', 'The rehearsed fallback for a venue with no internet: one competition runs on a venue laptop, then goes back online as one file. Online is always the normal way.', [
    'Before the day, online: press Start offline day on the competition and confirm. From then on staff changes and new entry requests for that competition are refused online, with a message that says why. Reading and the athletes\' own pages still work.',
    'Press Download database copy and put the file on the venue laptop, following the Offline day guide. Print the PIN cards from the laptop, because each card\'s QR code holds the address it was printed from.',
    'On the laptop the same page says "This is the venue laptop". After the competition, press Download day file there.',
    'Back online, press Load day file on the competition and choose the file. The system checks it first and lists what it holds: the competition\'s rounds, marks, results, entries and payments, which it replaces. Press Load it to keep it. The floor is cleared, the competition is released and the rankings show on the website.',
    'Take back cancels the offline day without loading anything; whatever the laptop did is not loaded.',
  ], [I('admin/offline-day', '', { h: 640 }), I('admin/offline-day-start', 'Hand it to the venue laptop')]),
  feat('Home page', 'Menu: Home page', 'The pictures on the public home page and beside the sign-in forms.', [
    'Hero picture: a wide, landscape photo works best. It shows on the right half of the home page, fading into the black on its left.',
    'Sign-in picture: a tall or square photo works best. It fills the right half of every sign-in page on laptops; phones do not show it.',
    'Change hero picture or Change sign-in picture chooses a JPG, PNG or WebP file. Use the built-in picture goes back to the original.',
  ], [I('admin/site', '', { h: 640 })]),
  feat('Points table', 'Menu: Points table', 'The ranking points for each place.', [
    'Edit the points for 1st to 7th and for the semi-final and quarter-final, then Save changes.',
    'Rankings update when the scrutineer approves a result.',
  ], [I('admin/points', '', { h: 640 })]),
  feat('Payments', 'Menu: Payments', 'What each team owes and has paid.', [
    'Cards at the top: Unpaid, Approved, Paid at venue and All. Search teams and filter by status.',
    'Press a row to see what it covers and who recorded it. Press Confirm payment on an unpaid one once the money has arrived. The secretariat can confirm payments too, but only the admin has this record.',
  ], [I('admin/payments', '', { h: 560 }), I('admin/payment-detail', '', { maxh: 130 })]),
  feat('Fees and payment details', 'Menu: Fees and payment details', 'Three tabs: Registration fees, Late entry fees and Accounts.', [
    'Registration fees: first entry and each extra entry for solos and couples, the fixed fees (ranking and inter-collegiate events, athlete and coach membership, Coaches Summit). Press Save registration fees.',
    'Late entry fees: the flat solo and couple fee for late entries. If late entries are refused, these are not set.',
    'Accounts: GCash, Maya or bank details that people see when they pay. Add a way to pay.',
    'Teams cannot enter events until the fees are saved.',
  ], [I('admin/fees', 'Registration fees', { h: 640 }), I('admin/fees-late', 'Late entry fees', { h: 460 }), I('admin/fees-accounts', 'Accounts', { h: 520 }), I('admin/payment-method-add')]),
  feat('Staff accounts', 'Menu: Staff accounts', 'Create and manage the people who run the system.', [
    'Add account: name, email, photo (required) and role (secretariat, scrutineer, chairperson, compere, barker or admin).',
    'The email is the role followed by @boss2026.com: admin@boss2026.com, secretariat@boss2026.com, scrutineer@boss2026.com, chairperson@boss2026.com, compere@boss2026.com or barker@boss2026.com. The system does not force it, so type it when you add the account.',
    'A temporary password appears once. Give it to the person in person.',
    'Row icons: edit, reset password, reset two-step sign-in (if on), sign out everywhere, delete.',
    'Open an account to read its activity log.',
    'On the Athletes screen, the pencil corrects an athlete\'s name or date of birth directly. Only the admin can do this.',
  ], [I('admin/staff', '', { h: 560 }), I('admin/staff-add'), I('admin/staff-password', 'Shown only once'), I('admin/staff-activity', 'An account\'s Activity tab', { maxh: 110 })]),
  feat('Security', 'Menu: Security', 'Turn on two-step sign-in and change your password.', [
    'Turn on: scan the code with an authenticator app, type the 6-digit code it shows and save the recovery codes it gives you.',
    'If someone loses their phone and codes, reset it for them on Staff accounts.',
  ], [I('admin/security', '', { h: 420 }), I('admin/two-step')]),
  feat('Backups and the secretariat\'s screens', 'Top of every screen; menu sections Entries and The day', 'Two more things for the admin.', [
    'A warning appears at the top if a backup folder fails.',
    'Your menu also holds every secretariat screen (Events, Teams, Coaches, Athletes, Entry requests, Account links, Profile changes, Late entries, Schedule, Heats, Program, Event list), so you can do that work from your own account. See the Secretariat section.',
    'You cannot start, approve or publish a round, or confirm a tie.',
  ]),
))

// ================================================================================ HOW IT WORKS
out.push(divider('How it works', 'From setup to published results.', 'The whole competition, step by step'))
out.push(pageNew(`
<p class="num">How it works</p><h1>The big picture</h1>
<p class="lead">Everyone has a part. Information moves from one person to the next, and ends on the website.</p>
<div class="chain">
  <div><b>Admin</b><span>Sets up the competition, staff, adjudicators, fees and points</span></div>
  <div><b>Secretariat</b><span>Enters dancers, gives back numbers, plans the program</span></div>
  <div><b>Scrutineer</b><span>Starts each round</span></div>
  <div><b>Adjudicators</b><span>Mark on their phones</span></div>
  <div><b>Scrutineer</b><span>Checks the marks and settles a tie in a final with the chairperson</span></div>
  <div><b>Scrutineer</b><span>Approves and publishes the result</span></div>
  <div><b>Compere and visitors</b><span>The compere announces it. Everyone sees it on the website</span></div>
</div>
<h2>How marks become results</h2>
<p><b>Early rounds (round 1, round 2, quarter-final, semi-final).</b> Each adjudicator marks an X for the number of couples to go on (the recall number). BOSS counts the X marks for each couple. The couples with the most X marks go through. Couples level with the last couple to be recalled all go through, so there is never a tie to settle in an early round.</p>
<p><b>The final.</b> Each adjudicator places every finalist, 1st to last, in each dance. BOSS works out the places with the official <b>Skating System</b>: a couple wins a place when a <b>majority</b> of the adjudicators (more than half) place them at that place or better. If couples still cannot be separated, the scrutineer proposes keeping the shared place or a tie-break dance, and the chairperson confirms.</p>
<p><b>Ranking points.</b> When the scrutineer approves a result, points from the admin's points table are added to each dancer's ranking. Rankings are kept per category, for example Junior I E1 Latin.</p>
<h2>Words used</h2>
<table>
<tr><td>Back number</td><td>The number pinned to a dancer's back.</td></tr>
<tr><td>Heat</td><td>A group dancing at the same time when a round is too big for the floor.</td></tr>
<tr><td>Recall</td><td>Being chosen to go to the next round.</td></tr>
<tr><td>X mark</td><td>An adjudicator's vote to recall a dancer.</td></tr>
<tr><td>Placing</td><td>An adjudicator's ranking in the final: 1 is best.</td></tr>
<tr><td>Panel</td><td>The adjudicators who mark an event.</td></tr>
<tr><td>Awarding</td><td>The ceremony where the winners are announced. A competition can hold every result until then.</td></tr>
</table>
`))

const step = (n, role, title, text, imgs = []) =>
  `<div class="step"><div class="sn">${n}</div><div class="sb"><p class="sr">${role}</p><h3>${title}</h3><p>${text}</p>${imgs.length ? `<div class="imgs">${imgs.join('')}</div>` : ''}</div></div>`

out.push(pageNew(`
<p class="num">Step by step</p><h1>Running a competition</h1>
<p class="lead">From the first setup to published results. Each step names who does it and where.</p>
<h2>Part 1 · Set up</h2>
${step(1, 'Admin', 'Set the fees and where to pay', 'Open <b>Fees and payment details</b>. Check the registration fees and the late entry fees, then add GCash, Maya or bank accounts under <b>Accounts</b>.')}
${step(2, 'Admin', 'Create the staff accounts', 'Open <b>Staff accounts</b> and add the secretariat, scrutineer, chairperson and compere, each with the email of its role: <b>secretariat@boss2026.com</b>, <b>scrutineer@boss2026.com</b>, <b>chairperson@boss2026.com</b> and <b>compere@boss2026.com</b> (the barker is <b>barker@boss2026.com</b>). Give each person their temporary password in person. Ask the secretariat and admin to turn on two-step sign-in.')}
${step(3, 'Admin', 'Add the adjudicators', 'Open <b>Adjudicators and panels</b> and add each adjudicator with a letter (A, B, C and so on).')}
${step(4, 'Admin', 'Check the points table', 'Open <b>Points table</b> and check the points for each place.')}
${step(5, 'Admin', 'Create the competition', 'Open <b>Competitions</b> and press <b>New competition</b>. Add the name, date, venue, organizer and a card photo. Set the entries and fees deadlines if you have them. Tick <b>Hold the results until the awarding</b> if every result is to be revealed together at the awarding.', [I('admin/competition-new', '', { mm: 62 })])}
${step(6, 'Secretariat', 'Add the events', 'Open <b>Events</b> and add each event with its age group, class, style and dances. Set the Kind (Beginners, Ranking, Inter-school or Closed to a province).')}
${step(7, 'Secretariat', 'Add the teams and coaches', 'Open <b>Teams</b> and <b>Coaches</b> and add each one once, as named on the entry forms.')}
<h2>Part 2 · Take entries</h2>
${step(8, 'Athletes, coaches, teams', 'Make accounts and link them', 'Each person presses <b>Sign in</b> on the website and creates an account. Coaches and teams then send a link request. The secretariat approves them under <b>Account links</b>.')}
${step(9, 'Secretariat', 'Enter dancers from entry forms', 'Open <b>Athletes</b>. Use <b>Add athlete</b> or <b>Import CSV</b>, then press the list icon on a row to enter the dancer in events and record how they paid.', [I('secretariat/enter-in-events', '', { mm: 64 })])}
${step(10, 'Secretariat', 'Approve entries sent online', 'Open <b>Entry requests</b>. Check each payment screenshot against the money received. Press the tick to approve, or the cross to turn down with a reason.')}
${step(11, 'Secretariat', 'Confirm memberships', 'Open <b>Athletes</b> and confirm each membership payment once the money arrives. The athlete\'s membership ID is given with the first one.')}
${step(12, 'Secretariat', 'Give out back numbers', 'On <b>Athletes</b>, press <b>Assign back numbers</b> once the entries are in.')}
${step(13, 'Admin', 'Choose the panels', 'On <b>Adjudicators and panels</b>, open the <b>Panels</b> tab and choose which adjudicators mark each event.')}
${step(14, 'Secretariat', 'Plan the day', 'Open <b>Schedule</b> to set the order of the events. Then open <b>Program</b>, press <b>Generate</b>, set the start time and add breaks. The program is now on the website for everyone.', [I('secretariat/program', '', { y: 0, h: 560 })])}
<h2>Part 3 · The day before</h2>
${step(15, 'Admin', 'Print the PIN cards', 'On <b>Adjudicators and panels</b>, choose the competition, tick the adjudicators and press <b>Print PIN cards</b>. Hand them out privately.')}
${step(16, 'Admin', 'Check the system', 'Make sure there is no backup warning at the top of the screen and that the server clock is right. PINs work only around the competition date. Check <b>Certificates</b> too: the layout, the signatures and the background. If the venue may have no internet, rehearse <b>Offline day</b> now.')}
${step(17, 'Secretariat', 'Print the heat lists', 'Open an event and press <b>Heat list</b>, or open <b>All printouts</b>.')}
${step(18, 'Everyone', 'Sign in and test', 'Staff sign in on their laptops. Each adjudicator signs in with their PIN and sees <b>Waiting for the next round</b>.', [I('adjudicator/waiting', '', { mm: 60, y: 780, h: 420 })])}
<h2>Part 4 · On the day, round by round</h2>
${step(19, 'Scrutineer', 'Plan the rounds (once)', 'Open <b>Rounds</b> and press <b>Plan rounds</b>. Every event with entries gets its rounds.')}
${step(20, 'Scrutineer', 'Split into heats if needed', 'If a round is too big for the floor, open <b>Heats</b>, press <b>Split evenly</b> and <b>Save heats</b>. The secretariat and the admin can do this too, even before the day. The program then shows each round\'s heats.')}
${step(21, 'Scrutineer', 'Start the round', 'On <b>Rounds</b>, press <b>Start</b> on the round. It appears on the adjudicators\' phones and the compere\'s screen shows the numbers to call. If it will not start, some entries are unpaid: the secretariat records the payment or scratches the dancer.', [I('scrutineer/rounds', '', { h: 560 })])}
${step(22, 'Adjudicators', 'Mark and sign', 'Early rounds: tap the numbers of the dancers to go through, exactly the number shown. Final: place every finalist 1st to last. Press <b>Submit</b>, check, then <b>Final and submit</b>, sign and press <b>Finalize</b>.', [I('adjudicator/mark-chosen', '', { mm: 34 }), I('adjudicator/review', '', { mm: 40 }), I('adjudicator/sign', '', { mm: 40 })])}
${step(23, 'Scrutineer', 'Watch the live board', 'Watch each phone go from <b>Waiting</b> to <b>Submitted</b>. If a phone cannot send, take the paper sheet and type it in on <b>Paper marks</b>.', [I('scrutineer/live-complete', '', { h: 640, mm: 120 })])}
${step(24, 'Scrutineer', 'Check the recall', 'Open <b>Recall</b>. Everyone level with the last couple to be recalled goes through, so there is nothing to decide. Then go to <b>Results</b>. If this is a final and two couples share a place, settle it as in step 27.', [I('scrutineer/recall', '', { h: 640, mm: 120 })])}
${step(25, 'Scrutineer', 'Approve and publish', 'Open <b>Results</b>. Check the table, press <b>Approve results</b>, then <b>Publish results</b>. The result is now on the website and on the compere\'s screen, and the ranking points are added.', [I('scrutineer/publish-confirm', '', { mm: 60 })])}
${step(26, 'Compere', 'Announce', 'The compere reads the numbers that go through (<b>Recalled</b>), or the places from last to first (<b>Results</b>). Press the arrows or number keys for the next announcement.', [I('compere/recalled', '', { h: 720, mm: 110 })])}
${step(27, 'Scrutineer', 'Next round', 'Go back to step 21 for the next round: round 1, round 2, quarter-final, semi-final and finally the final. In the final the adjudicators place every finalist, and if two couples still share a place, the <b>Tie in the final</b> box on <b>Results</b> asks the scrutineer to propose keeping the shared place, or a dance-off or tie-break order, and the chairperson presses <b>Confirm tie decision</b>. The final cannot be approved until then.', [I('scrutineer/final-tie-proposed', '', { h: 520, mm: 120 })])}
${step(28, 'Scrutineer or chairperson', 'Reveal the results (when they are held)', 'If the competition holds its results until the awarding, finals stay private after they are published. At the awarding, open <b>Results</b> and press <b>Reveal results</b>. Every event goes public at once and the compere reads the places from last to first, event by event.', [I('scrutineer/results-hold', '', { h: 330, mm: 120 }), I('scrutineer/reveal-confirm', '', { mm: 60 })])}
${step(29, 'Secretariat', 'Late changes', 'A dancer withdraws: open the event and press <b>Scratch</b>. A dancer arrives late: add them under <b>Late entries</b>. They cannot dance until they have paid.')}
<h2>Part 5 · After the competition</h2>
${step(30, 'Everyone', 'Results and standings are public', 'Visitors read the results on the competition page and the points on <b>Standings</b>. Athletes, coaches and teams see their results on their own pages.', [I('public/standings', '', { mm: 40, h: 1450 })])}
${step(31, 'Scrutineer', 'Print the results', 'Use <b>Print summary</b> on <b>Results</b>, or <b>All printouts</b> for score sheets and final results. Choose the event and press <b>Certificates</b> to print one for each placed finalist, from last place to 1st, once the final is approved.', [I('scrutineer/print-certificates', '', { y: 60, h: 700, mm: 110 })])}
${step(32, 'Admin', 'Check the money and the backups', 'Open <b>Payments</b> to see what is paid and what is still owed. Check there is no backup warning.')}
`))

out.push(pageNew(`
<p class="num">Help</p><h1>Common questions</h1>
<p class="lead">Quick answers. If these do not help, ask the secretariat or the admin.</p>
<table>
<tr><th>Question</th><th>Answer</th></tr>
<tr><td>I forgot my password.</td><td>Athletes, coaches and teams: press Forgot password? on the sign-in page and open the link we email you. Staff: ask the admin. Adjudicators: ask the admin for a new PIN.</td></tr>
<tr><td>The reset email did not arrive.</td><td>Check the spam folder and the spelling of the email. The link works once and for one hour; ask for a new one if it ran out.</td></tr>
<tr><td>It says to confirm my email.</td><td>Open the link in the email we sent, or press Send it again on your account page.</td></tr>
<tr><td>My entry or payment was turned down.</td><td>Teams: open Notifications or My requests to read the reason, fix it and send it again. Athletes: ask your team or the secretariat.</td></tr>
<tr><td>I cannot see my dancers.</td><td>Your account must be linked first. Open Link your team (or coach) and send the request.</td></tr>
<tr><td>A round will not start.</td><td>Some entries are not paid. The secretariat records the payment or scratches the dancer.</td></tr>
<tr><td>Results are not on the website.</td><td>The scrutineer has not published them yet, or the competition holds its results until the awarding and they have not been revealed.</td></tr>
<tr><td>The compere screen shows nothing for a final.</td><td>The final has not been published, or its results are held until the awarding. The scrutineer or chairperson presses Reveal results.</td></tr>
<tr><td>I opened a link and landed on the home page.</td><td>The address does not exist. Staff pages go to the staff sign-in instead.</td></tr>
<tr><td>A page says "No data available".</td><td>There is nothing to show yet, for example a competition with no program. If it says "Couldn't load this", press Try again.</td></tr>
<tr><td>A phone says marks are not sent.</td><td>They are saved. Move to mobile data or other Wi-Fi, or use the paper sheet.</td></tr>
<tr><td>Two couples have the same place in a final.</td><td>The scrutineer proposes how to settle it on Results (keep the shared place, a dance-off or a tie-break), the chairperson confirms, then the final can be approved.</td></tr>
<tr><td>An adjudicator's PIN is refused.</td><td>The admin makes a new one on Adjudicators and panels. A PIN only works around the competition date.</td></tr>
<tr><td>A wrong round was started.</td><td>The scrutineer presses Take off the floor. Possible until an adjudicator has submitted.</td></tr>
</table>
`))

// ---------------------------------------------------------------------------------------------- page
const css = `
  @font-face { font-family: 'Manrope'; src: url('${APP}/frontend/src/assets/manrope-latin-wght-normal.woff2') format('woff2'); font-weight: 200 800; }
  @page { size: A4; margin: 20mm 18mm 22mm;
    @bottom-left { content: 'BOSS User Manual'; font: 600 7.5pt 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #8a8379; border-top: 0.5pt solid #d8d3cb; padding-top: 3mm; vertical-align: top; }
    @bottom-right { content: counter(page); font: 600 7.5pt 'Manrope', sans-serif; color: #8a8379; border-top: 0.5pt solid #d8d3cb; padding-top: 3mm; vertical-align: top; } }
  @page full { size: A4; margin: 0; background: #0b0a09; @bottom-left { content: none; border: 0 } @bottom-right { content: none; border: 0 } }
  :root { --ink: #1a1613; --muted: #6b645c; --gold: #d9a520; --gold-text: #7a5a05; --line: #e6e2dc; --soft: #f7f5f1; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'Manrope', 'Segoe UI', Arial, sans-serif; color: var(--ink); font-size: 9.6pt; line-height: 1.55; }

  /* cover and dividers: full-bleed black */
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

  /* contents */
  .toc { break-before: page; break-after: page; }
  .intro { break-after: page; }
  .toc h1 { font-size: 30pt; margin-bottom: 8mm; }
  .toc a { display: flex; align-items: baseline; gap: 6mm; padding: 4.2mm 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
  .toc .tn { font-size: 8.5pt; font-weight: 700; color: var(--gold-text); width: 8mm; letter-spacing: .08em; }
  .toc .tt { font-size: 14pt; font-weight: 700; letter-spacing: -0.02em; width: 38mm; }
  .toc .td { flex: 1; color: var(--muted); font-size: 9pt; }
  .toc .tp { font-weight: 700; font-size: 10pt; font-variant-numeric: tabular-nums; }

  /* text */
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
  table { width: 100%; border-collapse: collapse; font-size: 9.2pt; margin-bottom: 6mm; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); border-bottom: 1px solid var(--ink); padding: 2.4mm 3mm 2.4mm 0; }
  td { border-bottom: 1px solid var(--line); padding: 2.2mm 3mm 2.2mm 0; vertical-align: top; }
  td:first-child { font-weight: 700; white-space: nowrap; padding-right: 6mm; }
  tr { break-inside: avoid; }
  .note { border: 1px solid var(--line); border-left: 1.2mm solid var(--gold); border-radius: 0 2mm 2mm 0; padding: 4mm 5mm; margin: 5mm 0; font-size: 9.4pt; background: var(--soft); }
  .signin { display: grid; grid-template-columns: 1fr 38mm; column-gap: 14mm; align-items: start; }
  .signin .note { margin-top: 6mm; }

  /* features: text on the left, screens on the right */
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
  .chain div { display: flex; gap: 4mm; padding: 1.8mm 0; border-bottom: 1px solid var(--line); align-items: baseline; }
  .chain div::before { content: '↓'; color: var(--gold-text); font-weight: 700; width: 4mm; }
  .chain div:first-child::before { content: '●'; }
  .chain b { width: 32mm; flex: 0 0 auto; }
  .chain span { color: var(--muted); }

  table.xl { margin-top: 3mm; font-size: 8pt; }
  table.xl td:first-child { font-weight: 700; white-space: nowrap; }
  .xn { font-size: 8pt; color: #3d3730; margin: 2mm 0 0; }

  /* steps */
  .step { display: grid; grid-template-columns: 12mm 1fr; padding: 4mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .sn { font-size: 13pt; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
  .sb { min-width: 0; }
  .sr { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .14em; color: var(--gold-text); font-weight: 700; margin: 0 0 .8mm; }
  .step h3 { font-size: 11.5pt; margin: 0 0 1mm; }
  .step p { margin: 0 0 2mm; color: #3d3730; }
  .step .imgs { display: flex; gap: 4mm; flex-wrap: wrap; align-items: flex-start; margin-top: 2mm; }
`

const toc = (pages) => `<section class="body toc"><p class="num">Contents</p><h1>Find your role</h1>
<p class="lead">Each section starts on a black page with the role's name, then explains every screen it has.</p>
${sections.map((s, i) => `<a><span class="tn">${s.n}</span><span class="tt">${s.name}</span><span class="td">${s.who}</span><span class="tp">${pages?.[i] || ''}</span></a>`).join('')}</section>`

const render = (pages) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BOSS User Manual</title><style>${css}</style></head>
<body>
${out.join('').replace('@@TOC@@', toc(pages))}
</body></html>`

const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p)) })
async function build(pages) {
  writeFileSync(join(DIR, 'manual.html'), render(pages))
  const pg = await browser.newPage()
  await pg.goto(pathToFileURL(join(DIR, 'manual.html')).href)
  await pg.waitForLoadState('networkidle')
  await pg.evaluate(() => document.fonts.ready)
  await pg.pdf({ path: join(DIR, 'BOSS_User_Manual.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
  await pg.close()
}
// Pass 1 lays the pages out; pass 2 prints the page numbers found in that PDF into the contents
await build(null)
const found = spawnSync('python', ['-I', join(DIR, 'findpages.py'), join(DIR, 'BOSS_User_Manual.pdf'), JSON.stringify(sections.map((s) => s.who))], { encoding: 'utf8' })
await build(found.status === 0 ? JSON.parse(found.stdout) : null)
await browser.close()
console.log('built')
