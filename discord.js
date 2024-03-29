// ? Thank you https://birdie0.github.io/discord-webhooks-guide/

import fetch, { FormData, fileFrom } from 'node-fetch'
import { checkStatus } from './utils.js'

export async function sendToDiscord (content, screenshotFilePath, pdfFilePath) {
  if (!process.env.WEBHOOK_ID || !process.env.WEBHOOK_TOKEN) {
    console.log('WEBHOOK_ID and WEBHOOK_TOKEN environment variables are required to send to Discord.')
    return
  }

  console.log('Getting files...')
  const [screenshot, pdf] = await Promise.all([fileFrom(screenshotFilePath), fileFrom(pdfFilePath)])

  const formData = new FormData()

  console.log('Setting data...')

  formData.set('username', 'Peter\'s Timetable Bot')
  formData.set('content', content)
  formData.set('avatar_url', 'https://i.imgur.com/oBPXx0D.png')
  formData.set('screenshot', screenshot)
  formData.set('pdf', pdf)

  console.log('Sending to Discord...')
  const response = checkStatus(await fetch(`https://discord.com/api/webhooks/${process.env.WEBHOOK_ID}/${process.env.WEBHOOK_TOKEN}`, { method: 'POST', body: formData }))
  const data = await response.json()

  if (process.env.GITHUB_ACTIONS) {
    delete data.id
    delete data.channel_id
    delete data.attachments[0].url
    delete data.attachments[0].proxy_url
    delete data.attachments[1].url
    delete data.attachments[1].proxy_url
    delete data.webhook_id
  }

  !(process.env.HIDE_RESPONSES === '1') && console.log('Response:\n\n', data)
}
