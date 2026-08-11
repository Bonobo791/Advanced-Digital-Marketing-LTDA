export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  mutate: ['src/lib/locale.ts', 'src/lib/services.ts', 'src/lib/attribution.ts', 'src/lib/constants.ts'],
  coverageAnalysis: 'off',
  reporters: ['clear-text', 'progress', 'html'],
}
