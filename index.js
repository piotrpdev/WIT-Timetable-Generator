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

if (!process.env.GITHUB_ACTIONS) {
  console.log('Running locally')
  // Check if the .env file exists
  if (!existsSync(join(dirname(fileURLToPath(import.meta.url)), '.env'))) {
    if (existsSync(join(dirname(fileURLToPath(import.meta.url)), '.env.local'))) {
      console.log('No .env file found, using .env.local instead.')
      dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env.local') })
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

try {
  // ? https://stackoverflow.com/a/62892482
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

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

  const date = ((new Date()).toISOString()).replaceAll(':', '-').replaceAll('.', '-')

  console.log(`Launching at ${date} using ${width}x${height}.`)
  const browser = await puppeteer.launch({
    // headless: false,
    // slowMo: 250,
    executablePath: getChromePath(),
    defaultViewport: { width, height }
  })

  console.log('Awaiting page...')
  const page = await browser.newPage()

  console.log('Going to URL...')
  await page.goto(url, {
    waitUntil: 'networkidle2'
  })

  console.log('Waiting for cboSchool to be visible...')
  const school = await page.waitForSelector('[name="cboSchool"]')

  // Selecting the school from the dropdown
  console.log(`Selecting school ('${process.env.SCHOOL}')...`)
  await school.select(process.env.SCHOOL)

  await page.waitForNetworkIdle() // A POST request is sent to the server after a dropdown value change, so we need to wait for it to finish.

  // If it's the weekend, get next week's timetable. (Technically the timetable updates late Friday, but I'm lazy.)
  const currentDay = new Date().getDay()

  if (currentDay === 0 || currentDay === 6) { // 0 = Sunday, 6 = Saturday
    console.log('It\'s the weekend, getting next week\'s timetable...')

    const weeks = await page.waitForSelector('[name="CboWeeks"]')

    let val = String(await weeks.getProperty('value')).slice(-2)

    console.log(`Current value: Week ${val}`)
    val = String(Number(val) + 1)

    console.log(`Setting value to: Week ${val}`)
    await weeks.select(val)

    await page.waitForNetworkIdle()
  }

  console.log('Waiting for CboDept to be visible...')
  const dept = await page.waitForSelector('[name="CboDept"]')

  // Selecting the dept from the dropdown
  console.log(`Selecting dept ('${process.env.DEPT}')...`)
  await dept.select(process.env.DEPT)

  await page.waitForNetworkIdle()

  console.log('Waiting for CboPOS to be visible...')
  const pos = await page.waitForSelector('[name="CboPOS"]')

  // Selecting the pos from the dropdown
  console.log(`Selecting pos ('${process.env.POS}')...`)
  await pos.select(process.env.POS)

  await page.waitForNetworkIdle()

  console.log('Waiting for CboStudParentGrp to be visible...')
  const group = await page.waitForSelector('[name="CboStudParentGrp"]')

  // Selecting the pos from the dropdown
  console.log(`Selecting group ('${process.env.GROUP}')...`)
  await group.select(process.env.GROUP)

  await page.waitForNetworkIdle() // Just in case.

  console.log('Finished with details!')

  console.log('Waiting for BtnRetrieve to be visible...')
  const genBtn = await page.waitForSelector('[name="BtnRetrieve"]')

  console.log('Clicking BtnRetrieve...')
  await genBtn.click()

  await page.waitForNetworkIdle()

  console.log('Isolating table...')

  const [divHeight, divWidth] = await page.evaluate(() => {
    document.body.innerHTML = '<html><head><style>#divTT { margin: 30px; width: min-content; }</style></head><body>' + document.querySelector('#divTT').outerHTML + '</body>'
    return [document.querySelector('#divTT').offsetHeight, document.querySelector('#divTT').offsetWidth]
  })

  console.log(`Creating Screenshot (${divWidth + 30 * 2}x${divHeight + 30 * 2}) (at ${screenshotDir})...`)

  await page.screenshot({
    path: join(screenshotDir, `${date}.png`),
    clip: { x: 0, y: 0, width: divWidth + 30 * 2, height: divHeight + 30 * 2 }
  })

  console.log(`Creating PDF (at ${pdfDir})...`)

  console.log('Emulating screen media...')
  await page.emulateMediaType('screen')

  console.log('Restoring colour...')
  await page.addStyleTag({ content: 'html { -webkit-print-color-adjust: exact; }' })

  await page.pdf({ path: join(pdfDir, `${date}.pdf`), margin: { right: '30px' } })

  console.log('Closing...')
  await browser.close()
} catch (error) {
  console.log(`Failed to run. ${error}`)
  process.exit(1)
}
