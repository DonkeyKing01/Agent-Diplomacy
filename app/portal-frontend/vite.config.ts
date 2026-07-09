import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'node:fs';
import path from 'path';

function buildDependencyAliases() {
  const packageJsonPath = path.resolve(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const dependencyNames = Object.keys(packageJson.dependencies || {});
  const nodeModulesDir = path.resolve(__dirname, 'node_modules');

  return dependencyNames.map((name) => ({
    find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/(.*))?$`),
    replacement: `${path.resolve(nodeModulesDir, name).replace(/\\/g, '/')}/$1`,
  }));
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react\/jsx-runtime$/,
        replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
      },
      ...buildDependencyAliases(),
      {
        find: '@',
        replacement: path.resolve(__dirname, '../frontend/src'),
      },
    ],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
  },
});
