// Node ESM resolve hook: allow extensionless .ts imports (Vite-style) under type stripping.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\\.(ts|js|mjs|cjs|json|css|wasm|node)(\\?|$)/.test(specifier)) {
      try { return await nextResolve(specifier + '.ts', context); } catch {}
      try { return await nextResolve(specifier + '.js', context); } catch {}
    }
    return nextResolve(specifier, context);
  }
`), pathToFileURL('./'));
