import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import { copyFile } from 'node:fs/promises'

const copyStyles = {
  name: 'copy-analytics-styles',
  writeBundle: () => copyFile('src/analytics.css', 'analytics.css')
}

export default {
  input: 'src/plugin.js',
  output: {
    file: 'index.js',
    format: 'cjs',
    exports: 'default',
    generatedCode: 'es2015',
    banner: '/* Tropy Analytics 1.8.1 - AGPL-3.0-or-later */'
  },
  external: ['electron', 'node:path', 'node:url'],
  plugins: [resolve({ exportConditions: ['node'], preferBuiltins: true }), commonjs(), copyStyles]
}
