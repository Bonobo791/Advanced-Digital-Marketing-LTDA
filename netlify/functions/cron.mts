import { schedule } from '@netlify/functions'

const tick = async (): Promise<void> => {
  if (process.env.CONTEXT !== 'production') return

  const siteUrl = process.env.URL
  const secret = process.env.CRON_SECRET

  if (!siteUrl || !secret) {
    throw new Error('URL and CRON_SECRET must be configured for the production cron function')
  }

  const response = await fetch(new URL('/api/cron', siteUrl), {
    headers: { 'x-cron-secret': secret },
  })

  if (!response.ok) {
    throw new Error(`Cron endpoint returned ${response.status}`)
  }
}

export const handler = schedule('* * * * *', tick)
