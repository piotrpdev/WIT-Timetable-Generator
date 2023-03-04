import dotenv from 'dotenv'

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

export function handleLocalDev (__dirname) {
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

    return true
  }

  return false
}

export async function getExampleTimetable (__dirname) {
  console.log('Getting example timetable...')

  const screenshotFilePath = join(__dirname, '.github', 'example', '2022-04-26T23-56-11-760Z.png')
  const pdfFilePath = join(__dirname, '.github', 'example', '2022-04-26T23-56-11-760Z.pdf')
  const jsonFilePath = join(__dirname, '.github', 'example', '2022-04-26T23-56-11-760Z.json')

  const timetableJson = JSON.parse(await readFile(jsonFilePath, 'utf8'))

  return { weekText: 'week 35 (25-APR-22)', screenshotFilePath, pdfFilePath, timetableJson }
}
