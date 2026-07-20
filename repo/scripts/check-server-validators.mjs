import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'

const ROOT = new URL('../src/', import.meta.url)
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const DEPRECATED_PATTERN = /\.inputValidator\s*\(/g
const CURRENT_PATTERN = /\.validator\s*\(/g

async function walk(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryUrl = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directoryUrl)
    if (entry.isDirectory()) {
      files.push(...(await walk(entryUrl)))
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(entryUrl)
    }
  }

  return files
}

const files = await walk(ROOT)
const deprecatedMatches = []
let currentValidatorCount = 0

for (const fileUrl of files) {
  const source = await readFile(fileUrl, 'utf8')
  const relativePath = relative(new URL('../', import.meta.url).pathname, fileUrl.pathname)

  for (const match of source.matchAll(DEPRECATED_PATTERN)) {
    const line = source.slice(0, match.index).split('\n').length
    deprecatedMatches.push(`${relativePath}:${line}`)
  }

  currentValidatorCount += [...source.matchAll(CURRENT_PATTERN)].length
}

if (deprecatedMatches.length > 0) {
  console.error('Deprecated TanStack .inputValidator() calls found:')
  for (const match of deprecatedMatches) {
    console.error(`- ${match}`)
  }
  process.exit(1)
}

console.log(`Server validator check passed: ${currentValidatorCount} .validator() calls, 0 deprecated calls.`)
