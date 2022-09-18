// ? Pretty much just a reworking of this: https://github.com/lannonbr/puppeteer-screenshot-action

// Copyright (c) 2022 Piotr Bogdan Placzek (piotrpdev)

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'fs'
import { type } from 'os'
import { fileURLToPath } from 'url'
import { join, normalize, dirname } from 'path'
import dotenv from 'dotenv'
import { sendToDiscord } from './discord.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!process.env.GITHUB_ACTIONS) {
  console.log('Running locally')
  // Check if the .env file exists
  if (!existsSync(join(__dirname, '.env'))) {
    if (existsSync(join(__dirname, '.env.local'))) {
      console.log('No .env file found, using .env.local instead.')
      dotenv.config({ path: join(__dirname, '.env.local') })
    } else {
      console.log('No .env or .env.local file found, I hope you know what you\'re doing.')
    }
  } else {
    dotenv.config()
  }
}

function getChromePath () {
  let browserPath

  if (type() === 'Windows_NT') {
    // Chrome is usually installed as a 32-bit application, on 64-bit systems it will have a different installation path.
    const programFiles = process.env.PROGRAMFILES
    browserPath = join(
      programFiles,
      'Google/Chrome/Application/chrome.exe'
    )
  } else if (type() === 'Linux') {
    browserPath = '/usr/bin/google-chrome'
  } else if (type() === 'Darwin') {
    browserPath =
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }

  if (browserPath && browserPath.length > 0) {
    return normalize(browserPath)
  }

  throw new TypeError(`Cannot run action. ${type} is not supported.`)
}

const fields = {
  SCHOOL: '[name="cboSchool"]',
  DEPT: '[name="CboDept"]',
  POS: '[name="CboPOS"]',
  GROUP: '[name="CboStudParentGrp"]'
}

try {
  // ? https://stackoverflow.com/a/62892482
  const screenshotDir = join(__dirname, 'screenshots')
  const pdfDir = join(__dirname, 'pdfs')

  if (!existsSync(screenshotDir)) {
    console.log(`Creating '${screenshotDir}'.`)
    mkdirSync(screenshotDir)
  }

  if (!existsSync(pdfDir)) {
    console.log(`Creating '${pdfDir}'.`)
    mkdirSync(pdfDir)
  }

  const url = 'http://studentssp.wit.ie/Timetables/StudentGroupTT.aspx'

  const width = 1920
  const height = 1080

  const _date = new Date()
  const safeDate = (_date).toISOString().replaceAll(/[:.]/g, '-')
  const formattedDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Eire', dateStyle: 'short', timeStyle: 'short' }).format(_date).split(', ').reverse().join(', ')

  console.log(`\nLaunching at ${formattedDate} (${safeDate}) using ${width}x${height}.`)
  const browser = await puppeteer.launch({
    ...(process.env.ACT && { args: ['--no-sandbox', '--disable-setuid-sandbox'] }), // ? For testing purposes (act)
    // headless: false,
    // slowMo: 250,
    executablePath: getChromePath(),
    defaultViewport: { width, height }
  })

  console.log('Awaiting page...')
  const page = await browser.newPage()

  console.log('Going to URL...\n')
  await page.goto(url, {
    waitUntil: 'networkidle2'
  })

  // If it's the weekend, get next week's timetable. (Technically the timetable updates late Friday, but I'm lazy.)
  // const currentDay = new Date().getDay()

  console.log('Waiting for [name="CboWeeks"] to be visible...')
  const weeks = await page.waitForSelector('[name="CboWeeks"] [selected]')

  const val = await (await weeks.getProperty('value')).jsonValue()
  const weekText = await (await weeks.getProperty('text')).jsonValue()

  console.log(`Current value: Week ${val} ('${weekText}')\n`)

  // Looks like it automatically does it now (on the weekend)?
  // Maybe skip on Friday to get next weeks? Add option for this?
  // if (currentDay === 0 || currentDay === 6) { // 0 = Sunday, 6 = Saturday
  //   console.log('It\'s the weekend, getting next week\'s timetable...')

  //   // val = String(Number(val) + 1)

  //   // console.log(`Setting value to: Week ${val}\n`)
  //   // await weeks.select(val)

  //   //await page.waitForNetworkIdle()
  // }

  for (const [name, selector] of Object.entries(fields)) {
    console.log(`Waiting for ${selector} to be visible...`)
    const handle = await page.waitForSelector(selector)

    // Selecting the value from the dropdown
    console.log(`Selecting value${process.env.GITHUB_ACTIONS ? '' : ` ('${process.env[name]}')`}...\n`)
    await handle.select(process.env[name])

    await page.waitForNetworkIdle() // A POST request is sent to the server after a dropdown value change, so we need to wait for it to finish.
  }

  console.log('Finished with details!\n')

  console.log('Waiting for [name="BtnRetrieve"] to be visible...')
  const genBtn = await page.waitForSelector('[name="BtnRetrieve"]')

  console.log('Clicking...\n')
  await genBtn.click()

  await page.waitForNetworkIdle()

  console.log('Isolating table...\n')

  const [divHeight, divWidth] = await page.evaluate(() => {
    document.body.innerHTML = '<html><head><style>html { -webkit-print-color-adjust: exact; } #divTT { margin: 30px; width: min-content; }</style></head><body>' + document.querySelector('#divTT').outerHTML + '</body>'
    return [document.querySelector('#divTT').offsetHeight, document.querySelector('#divTT').offsetWidth]
  })

  console.log(`Creating Screenshot (${divWidth + 30 * 2}x${divHeight + 30 * 2}) (at ${screenshotDir})...\n`)

  await page.screenshot({
    path: join(screenshotDir, `${safeDate}.png`),
    clip: { x: 0, y: 0, width: divWidth + 30 * 2, height: divHeight + 30 * 2 }
  })

  console.log('Emulating screen media...')
  await page.emulateMediaType('screen')

  console.log(`Creating PDF (at ${pdfDir})...\n`)

  await page.pdf({ path: join(pdfDir, `${safeDate}.pdf`), margin: { right: '30px' } })

  console.log('Closing...\n')
  await browser.close()

  await sendToDiscord(weekText.charAt(0).toUpperCase() + weekText.slice(1), join(pdfDir, `${safeDate}.pdf`), join(screenshotDir, `${safeDate}.png`))
} catch (error) {
  console.log(`Failed to run. ${error}`)
  process.exit(1)
}
