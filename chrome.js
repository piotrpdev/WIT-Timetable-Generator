import { type } from 'os'
import { join, normalize } from 'path'

export function getChromePath () {
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
