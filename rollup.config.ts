import type { RollupOptions } from 'rollup';
import terser from '@rollup/plugin-terser';

const config: RollupOptions = {
  input: "./src/index.js",
  output: [
    {
      file: './dist/index.cjs',
      format: 'cjs'
    },
    {
      file: './dist/index.mjs',
      format: 'es'
    }
  ],
  external: [/^node/, /^@babel/],
  // plugins: [terser({
  //   compress: {
  //     defaults: false
  //   },
  //   format: {
  //     comments: false
  //   }
  // })]
};

export default config;