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

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { sendToDiscord } from './discord.js'
import { getTimetable } from './timetable.js'
import { getExampleTimetable, handleLocalDev } from './dev.js'
import { uploadToGist } from './gist.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const screenshotDir = join(__dirname, 'screenshots')
const pdfDir = join(__dirname, 'pdfs')

handleLocalDev(__dirname)

const { weekText, screenshotFilePath, pdfFilePath, timetableJson } = !(process.env.USE_LOCAL_TIMETABLE === '1') ? await getTimetable(screenshotDir, pdfDir) : await getExampleTimetable(__dirname)

!(process.env.SKIP_DISCORD === '1') && await sendToDiscord(weekText.charAt(0).toUpperCase() + weekText.slice(1), screenshotFilePath, pdfFilePath)

!(process.env.SKIP_JSON_UPLOAD === '1') && await uploadToGist(timetableJson, weekText)
