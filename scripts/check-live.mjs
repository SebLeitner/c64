// Verify the published HTML and all bundled JS, CSS and WASM, including their
// actual bytes. A reachable CloudFront default page is not a successful deploy.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = process.argv[2];
if (!base?.startsWith("https://"))
  throw new Error("HTTPS-Ziel als Argument erforderlich.");
const local = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const paths = [
  "/",
  ...new Set(
    [...local.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(
      (match) => match[1],
    ),
  ),
];
const scriptPaths = paths.filter((path) => path.endsWith(".js"));
for (const path of scriptPaths) {
  const js = await readFile(new URL(`../dist${path}`, import.meta.url), "utf8");
  for (const match of js.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.(?:wasm|js)/g))
    paths.push(match[0]);
}
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const path of new Set(paths)) {
  const expected = await readFile(
    new URL(
      path === "/" ? "../dist/index.html" : `../dist${path}`,
      import.meta.url,
    ),
  );
  let last;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(new URL(path, base), {
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (
        path.endsWith(".wasm") &&
        !response.headers.get("content-type")?.startsWith("application/wasm")
      )
        throw new Error("WASM-MIME-Type fehlt");
      const received = new Uint8Array(await response.arrayBuffer());
      if (digest(received) !== digest(expected))
        throw new Error("Remote-Datei stimmt nicht mit dem Build überein");
      console.log(`OK ${new URL(path, base)}`);
      last = null;
      break;
    } catch (error) {
      last = error;
      if (attempt < 11)
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  if (last) throw new Error(`${path}: ${last.message}`);
}
