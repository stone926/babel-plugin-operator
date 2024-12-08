import type { RollupOptions } from 'rollup';

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
  external: [/^node/, /^@babel/]
};

export default config;