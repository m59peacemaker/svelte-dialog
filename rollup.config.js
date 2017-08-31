import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import svelte from 'rollup-plugin-svelte'

const Plugins = () => [
  resolve({
    module: true, browser: true, jsnext: true, main: true, extensions: [ '.js', '.json' ]
  }),
  commonjs(),
  svelte({ cascade: false })
]

export default [
  {
    input: 'src/Dialog.html',
    output: {
      file: 'build/index.js',
      format: 'es'
    },
    plugins: Plugins()
  },

  {
    input: 'src/Dialog.html',
    output: {
      file: 'build/index.cjs.js',
      format: 'cjs'
    },
    plugins: Plugins()
  }
]
