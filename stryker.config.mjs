export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  mutate: ['src/lib/server/cron.ts', 'src/routes/api/cron/+server.ts'],
  coverageAnalysis: 'off',
  reporters: ['clear-text', 'progress', 'html'],
}
