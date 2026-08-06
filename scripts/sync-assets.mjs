// Downloads the two AI-generated image assets when they are not present locally.
// The binaries are not committed to the repo (they came out of an image
// generation pipeline). If these URLs ever expire, drop the .jpg files into
// src/lib/assets/ yourself and this script will leave them untouched.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ASSETS = [
  {
    file: 'src/lib/assets/andrew-portrait.jpg',
    url: 'https://www.kimi.com/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2Fd412ee7a90ed3f2c444228f310492894dc9e02d4ffb94c61d5c16631af2d2e9a?filename=andrew-portrait.jpg&sig=fbzTyPfB3qiiv95byMvnkIR3H2Gd2jZdFgX9Azg1Njc=&t=o',
  },
  {
    file: 'src/lib/assets/data-city.jpg',
    url: 'https://www.kimi.com/apiv2-files/sign-obj/kimi-fs%2Ffiles%2Fblob%2F625ee685137ebe19d71b762f2e25428fb30e064b2475a162863c708952a33571?filename=data-city.jpg&sig=M9WQ3i_7qmP-MA82fLQdlDJUhLIgBo5MGLz3OVra110=&t=o',
  },
]

for (const { file, url } of ASSETS) {
  const dest = join(root, file)
  if (existsSync(dest)) {
    console.log(`[sync-assets] ok   ${file} (already present, skipping)`)
    continue
  }
  console.log(`[sync-assets] get  ${file}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `[sync-assets] download failed (${res.status}) for ${file}. ` +
        `Place the file manually at ${file} and re-run. See README.`,
    )
  }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}
console.log('[sync-assets] done')
