// Downloads the optional remote image asset when it is not present locally.
// This optional binary comes from an image generation pipeline. If its URL
// ever expires, place the file manually in src/lib/assets/ and the script
// will leave it untouched.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ASSETS = [
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
