import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { generateImage, generateText } from './lib/ai'

async function testAll() {
  console.log('Testing text...')
  const text = await generateText('Generate prompt text of a Hindu woman celebrating karwa chauth with her husband')
  console.log('Text result:', text)

  console.log('Testing image...')
  const imgSrc = await generateImage('A red coffee cup on a white table, product photography')

  console.log('Image type:', imgSrc.startsWith('data:image/svg') ? 'SVG fallback' : 'Base64 PNG')
  console.log('Image src preview:', imgSrc.slice(0, 60))

  // Render it on the page
  const img = document.createElement('img')
  img.src = imgSrc
  img.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    width: 180px;
    height: 180px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid #ccc;
    background: white;
    z-index: 9999;
  `
  img.onerror = () => console.error('Image failed to render — src was:', imgSrc.slice(0, 100))
  img.onload  = () => console.log('Image rendered successfully')
  document.body.appendChild(img)
}

//testAll()