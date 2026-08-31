// Node ESM loader hooks that stub out `.css`/`.module.css` imports as an
// empty module. `node --test` runs component `.tsx` files directly (via the
// `tsx` loader for TS/JSX transpilation) with no bundler in front of it, so
// a component's own `import styles from "./Foo.module.css"` would otherwise
// fail with ERR_UNKNOWN_FILE_EXTENSION — this lets tests import pure helper
// functions co-located in a component file without needing to extract them
// into a separate CSS-free module.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return { url: `css-stub:${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("css-stub:")) {
    return { format: "module", source: "export default {};", shortCircuit: true };
  }
  return nextLoad(url, context);
}
