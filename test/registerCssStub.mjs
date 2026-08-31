import { registerHooks } from "node:module";

// `node --test` runs component `.tsx` files directly (via the `tsx` loader
// for TS/JSX transpilation) with no bundler in front of it, so a component's
// own `import styles from "./Foo.module.css"` would otherwise fail with
// ERR_UNKNOWN_FILE_EXTENSION. This stubs `.css` imports as an empty module
// so tests can import pure helper functions co-located in a component file
// (e.g. `FlightInfoPane.tsx`) without extracting them into a separate,
// CSS-free module just for testability.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith(".css")) {
      return { url: `css-stub:${specifier}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("css-stub:")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
