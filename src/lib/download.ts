import JSZip from 'jszip'

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function svgWithText(svgString: string, lines: string[]): string {
  const textY   = 20
  const overlays = lines.map((line, i) =>
    `<text x="200" y="${textY + i * 22}" text-anchor="middle"
      font-family="sans-serif" font-size="16"
      fill="white" stroke="black" stroke-width="0.5">${line}</text>`
  ).join('')
  return svgString.replace('</svg>', `<g>${overlays}</g></svg>`)
}

export async function downloadPosterZip(poster: {
  imageData: string
  isSvg:     boolean
  headline:  string
  tagline:   string
  cta:       string
}) {
  const zip      = new JSZip()
  const imgFolder  = zip.folder('images')!
  const txtFolder  = zip.folder('text')!
  const embedFolder = zip.folder('images-with-text')!

  const ext = poster.isSvg ? 'svg' : 'png'

  if (poster.isSvg) {
    const raw = poster.imageData.startsWith('data:')
      ? atob(poster.imageData.split(',')[1]) : poster.imageData
    imgFolder.file(`poster.${ext}`, raw)
    const embedded = svgWithText(raw, [poster.headline, poster.tagline, poster.cta])
    embedFolder.file(`poster-with-text.svg`, embedded)
  } else {
    imgFolder.file(`poster.png`, dataUrlToUint8(poster.imageData))
  }

  const copy = `Headline: ${poster.headline}\nTagline:  ${poster.tagline}\nCTA:      ${poster.cta}`
  txtFolder.file('copy.txt', copy)

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, 'poster-assets.zip')
}

export async function downloadReelsZip(scenes: Array<{
  scene:     number
  voiceover: string
  caption:   string
  visual:    string
  cta:       string
  duration:  string
  imageUrl?: string
}>) {
  const zip       = new JSZip()
  const imgFolder  = zip.folder('storyboard-images')!
  const txtFolder  = zip.folder('script')!
  const embedFolder = zip.folder('images-with-text')!

  const scriptLines = scenes.map(s =>
    `Scene ${s.scene} (${s.duration})\nVoiceover: ${s.voiceover}\nCaption: "${s.caption}"${s.cta ? '\nCTA: ' + s.cta : ''}`
  ).join('\n\n---\n\n')
  txtFolder.file('reels-script.txt', scriptLines)

  for (const s of scenes) {
    if (!s.imageUrl || s.imageUrl === 'error') continue
    if (s.imageUrl.startsWith('data:image/svg')) {
      const raw = atob(s.imageUrl.split(',')[1])
      imgFolder.file(`scene-${s.scene}.svg`, raw)
      const embedded = svgWithText(raw, [s.caption])
      embedFolder.file(`scene-${s.scene}-with-text.svg`, embedded)
    } else if (s.imageUrl.startsWith('data:image/png')) {
      imgFolder.file(`scene-${s.scene}.png`, dataUrlToUint8(s.imageUrl))
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, 'reels-assets.zip')
}

export async function downloadStoriesZip(slides: Array<{
  slide:    number
  headline: string
  subtext:  string
  cta:      string
  imageUrl?: string
}>) {
  const zip        = new JSZip()
  const imgFolder  = zip.folder('story-images')!
  const txtFolder  = zip.folder('captions')!
  const embedFolder = zip.folder('images-with-text')!

  const captions = slides.map(s =>
    `Slide ${s.slide}\nHeadline: ${s.headline}\nSubtext:  ${s.subtext}\nCTA:      ${s.cta}`
  ).join('\n\n---\n\n')
  txtFolder.file('story-captions.txt', captions)

  for (const s of slides) {
    if (!s.imageUrl || s.imageUrl === 'error') continue
    if (s.imageUrl.startsWith('data:image/svg')) {
      const raw = atob(s.imageUrl.split(',')[1])
      imgFolder.file(`slide-${s.slide}.svg`, raw)
      const embedded = svgWithText(raw, [s.headline, s.cta])
      embedFolder.file(`slide-${s.slide}-with-text.svg`, embedded)
    } else if (s.imageUrl.startsWith('data:image/png')) {
      imgFolder.file(`slide-${s.slide}.png`, dataUrlToUint8(s.imageUrl))
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, 'stories-assets.zip')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}