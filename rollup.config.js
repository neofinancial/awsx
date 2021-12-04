import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const watch = process.env.ROLLUP_WATCH === 'true';

export default {
  input: 'src/app.ts',
  output: {
    file: 'build/index.js',
    format: 'cjs',
    exports: 'named',
  },
  external: ['fs', 'path', 'util', 'update-notifier'],
  plugins: [typescript(), json(), commonjs(), nodeResolve(), !watch && terser()],
};
