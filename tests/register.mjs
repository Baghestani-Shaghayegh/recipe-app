// Lets Node's built-in test runner load the app's TypeScript files, whose relative
// imports leave out the ".ts" extension (as Metro/TypeScript expect).
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + '.ts', context);
    }
    throw err;
  }
}`),
  import.meta.url,
);
