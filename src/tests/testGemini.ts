import { generateText, generateJSON } from '../lib/gemini'

async function runTest() {
  console.log('--- Gemini Test Starting ---')

  console.log('Test 1: Plain text generation')
  try {
    const result = await generateText(
      'Write a 1-sentence tagline for a cold brew coffee brand.'
    )
    console.log('PASS - Text result:', result)
  } catch (e: any) {
    console.error('FAIL - Text test error:', e.message)
  }

  console.log('Test 2: JSON generation')
  try {
    const result = await generateJSON<{headline:string, tagline:string}>(
      `Create ad copy for a cold brew coffee brand.
       Return JSON: { "headline": "...", "tagline": "..." }`
    )
    console.log('PASS - JSON result:', result)
    console.log('headline value:', result.headline)
    console.log('tagline value:', result.tagline)
  } catch (e: any) {
    console.error('FAIL - JSON test error:', e.message)
  }

  console.log('--- Gemini Test Done ---')
}

runTest()