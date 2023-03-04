import fetch from 'node-fetch'
import { checkStatus } from './utils.js'

export async function uploadToGist (timetableJson, weekText) {
  const { GH_GIST_ID, GH_PAT } = process.env

  if (!GH_GIST_ID || !GH_PAT) {
    console.log('GH_GIST_ID and GH_PAT environment variables are required to upload to Gist.')
    return
  }

  console.log('Uploading to Gist...')

  const response = checkStatus(await fetch(`https://api.github.com/gists/${GH_GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GH_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: `Timetable for ${weekText}`,
      files: {
        'timetable.json': {
          content: JSON.stringify(timetableJson)
        }
      }
    })
  }))

  let data = await response.json()

  if (process.env.GITHUB_ACTIONS) {
    data = {
      files: {
        'timetable.json': {
          filename: data.files['timetable.json'].filename,
          type: data.files['timetable.json'].type,
          language: data.files['timetable.json'].language,
          size: data.files['timetable.json'].size
        }
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      description: data.description
    }
  }

  !(process.env.HIDE_RESPONSES === '1') && console.log('Response:\n\n', data)
}
