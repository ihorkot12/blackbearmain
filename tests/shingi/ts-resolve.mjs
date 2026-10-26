export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js')) {
    try {
      return await nextResolve(specifier.slice(0, -3) + '.ts', context);
    } catch {
      // файлу .ts нема — лишаємо як є
    }
  }
  return nextResolve(specifier, context);
}
