// Builds dry-run-fixes-scrutineer.pdf from dry-run-fixes-scrutineer.html. Run with: node docs/operations/build-dry-run-fixes-scrutineer.mjs
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIR = import.meta.dirname
const ROOT = resolve(DIR, '..', '..')
const { chromium } = createRequire(join(ROOT, 'package.json'))('playwright-core')

const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p)) })
const page = await browser.newPage()
await page.goto(pathToFileURL(join(DIR, 'dry-run-fixes-scrutineer.html')).href)
await page.pdf({ path: join(DIR, 'dry-run-fixes-scrutineer.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true })
await browser.close()
console.log('dry-run-fixes-scrutineer.pdf written')
