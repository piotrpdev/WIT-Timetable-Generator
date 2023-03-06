// ? https://stackoverflow.com/a/62892482

import puppeteer from 'puppeteer-core'

import { existsSync, mkdirSync } from 'fs'

import { join } from 'path'
import { getChromePath } from './chrome.js'
import { generateJson } from './generateJson.js'
import { writeFile } from 'fs/promises'

const fields = {
  SCHOOL: '[name="cboSchool"]',
  DEPT: '[name="CboDept"]',
  POS: '[name="CboPOS"]',
  GROUP: '[name="CboStudParentGrp"]'
}

export async function getTimetable (screenshotDir, pdfDir, jsonDir) {
  if (!existsSync(screenshotDir)) {
    console.log(`Creating '${screenshotDir}'.`)
    mkdirSync(screenshotDir)
  }

  if (!existsSync(pdfDir)) {
    console.log(`Creating '${pdfDir}'.`)
    mkdirSync(pdfDir)
  }

  if (!existsSync(jsonDir)) {
    console.log(`Creating '${jsonDir}'.`)
    mkdirSync(jsonDir)
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

  console.log('Waiting for [name="CboWeeks"] to be visible...')
  const weeks = await page.waitForSelector('[name="CboWeeks"] [selected]')

  let val = await (await weeks.getProperty('value')).jsonValue()
  let weekText = await (await weeks.getProperty('text')).jsonValue()

  console.log(`Current value: Week ${val} ('${weekText}')\n`)

  // If it's the weekend, get next week's timetable. (Technically the timetable updates late Friday, but I'm lazy.)
  const currentDay = new Date().getDay()

  // Looks like it automatically does it now (on the weekend)?
  // Maybe skip on Friday to get next weeks? Add option for this?
  // 15/1/23 Doesn't auto update now?
  if (currentDay === 0 || currentDay === 6) { // 0 = Sunday, 6 = Saturday
    console.log('It\'s the weekend, getting next week\'s timetable...')

    val = String(Number(val) + 1)

    console.log(`Setting value to: Week ${val}\n`)
    const weeksBox = await page.waitForSelector('[name="CboWeeks"]')
    await weeksBox.select(val)

    const wks = await page.waitForSelector('[name="CboWeeks"] [selected]')
    const wksTxt = await wks.getProperty('text')

    weekText = await wksTxt.jsonValue()

    await page.waitForNetworkIdle()
  }

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

  weekText = weekText.charAt(0).toUpperCase() + weekText.slice(1)

  console.log('Generating JSON...\n')

  const timetableJson = await generateJson(page)

  timetableJson.weekText = weekText
  timetableJson.generatedDate = formattedDate

  timetableJson.devDetails = {}
  timetableJson.devDetails.generatedDate = _date

  for (const [name, selector] of Object.entries(fields)) {
    const dropValue = await page.waitForSelector(`${selector} [selected]`)
    const dropValueTxt = await dropValue.getProperty('text')

    timetableJson[name] = await dropValueTxt.jsonValue()
    timetableJson.devDetails[name] = process.env[name]
  }

  const jsonFilePath = join(jsonDir, `${safeDate}.json`)
  writeFile(jsonFilePath, JSON.stringify(timetableJson, null, 2))

  console.log('JSON generated!\n')
  // ! (process.env.HIDE_RESPONSES === '1') && console.dir(timetableJson)

  console.log('Isolating table...\n')

  const [divHeight, divWidth] = await page.evaluate(() => {
    document.body.innerHTML = '<html><head><style>html { -webkit-print-color-adjust: exact; } #divTT { margin: 30px; width: min-content; }</style></head><body>' + document.querySelector('#divTT').outerHTML + '</body>'
    return [document.querySelector('#divTT').offsetHeight, document.querySelector('#divTT').offsetWidth]
  })

  console.log(`Creating Screenshot (${divWidth + 30 * 2}x${divHeight + 30 * 2}) (at ${screenshotDir})...\n`)

  const screenshotFilePath = join(screenshotDir, `${safeDate}.png`)

  await page.screenshot({
    path: screenshotFilePath,
    clip: { x: 0, y: 0, width: divWidth + 30 * 2, height: divHeight + 30 * 2 }
  })

  console.log('Emulating screen media...')
  await page.emulateMediaType('screen')

  console.log(`Creating PDF (at ${pdfDir})...\n`)

  const pdfFilePath = join(pdfDir, `${safeDate}.pdf`)

  await page.pdf({ path: pdfFilePath, margin: { right: '30px' } })

  console.log('Closing...\n')
  await browser.close()

  return { weekText, screenshotFilePath, pdfFilePath, timetableJson }
}
