/**
 * Reads test/test-results.json and writes test/test-results.md with a human-friendly table.
 * Run after `npm test` (see package.json test script).
 */
import fs from 'node:fs'
import path from 'node:path'

const resultsPath = 'test/test-results.json'
const outputPath = 'test/test-results.md'
const cwd = process.cwd()

let data
try {
  data = JSON.parse(fs.readFileSync(path.join(cwd, resultsPath), 'utf8'))
} catch (err) {
  console.error('write-test-summary: could not read', resultsPath, err.message)
  process.exit(1)
}

const { numTotalTests, numPassedTests, numFailedTests, success, startTime, testResults } = data
const date = new Date(startTime).toISOString()

const lines = [
  '# Test results',
  '',
  `**Generated:** ${date}`,
  '',
  '| Summary | Count |',
  '|---------|-------|',
  `| Total tests | ${numTotalTests} |`,
  `| Passed | ${numPassedTests} |`,
  `| Failed | ${numFailedTests} |`,
  `| Overall | ${success ? '✅ Passed' : '❌ Failed'} |`,
  '',
  '---',
  '',
  '## Test cases',
  '',
  '| File | Test | Status | Duration (ms) |',
  '|------|------|--------|---------------|',
]

for (const fileResult of testResults || []) {
  const filePath = fileResult.name || ''
  const relativePath = path.isAbsolute(filePath)
    ? path.relative(cwd, filePath).replace(/\\/g, '/')
    : filePath

  for (const test of fileResult.assertionResults || []) {
    const name = test.title || test.fullName || '—'
    const status = test.status === 'passed' ? '✅ passed' : '❌ failed'
    const duration = test.duration != null ? Number(test.duration).toFixed(2) : '—'
    const safeName = name.replace(/\|/g, '\\|').replace(/\n/g, ' ')
    const safePath = relativePath.replace(/\|/g, '\\|')
    lines.push(`| ${safePath} | ${safeName} | ${status} | ${duration} |`)
  }
}

if (data.testResults?.some((r) => r.assertionResults?.some((t) => t.status === 'failed' && t.failureMessages?.length))) {
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Failures')
  lines.push('')
  for (const fileResult of data.testResults || []) {
    for (const test of fileResult.assertionResults || []) {
      if (test.status !== 'failed' || !test.failureMessages?.length) continue
      lines.push(`### ${(test.fullName || test.title).replace(/\|/g, '\\|')}`)
      lines.push('')
      lines.push('```')
      for (const msg of test.failureMessages) lines.push(msg)
      lines.push('```')
      lines.push('')
    }
  }
}

fs.writeFileSync(path.join(cwd, outputPath), lines.join('\n'), 'utf8')
console.log('Test summary written to', outputPath)
