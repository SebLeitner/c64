import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const version = "1.13.4";
// Official hashes: https://releases.hashicorp.com/terraform/1.13.4/terraform_1.13.4_SHA256SUMS
const hashes = {
  linux_amd64:
    "98aa516201e948306698efd9954ab4cc0d1227c2578ba56245898b5f679e590b",
  linux_arm64:
    "a17bde150a4d6c9e7ece063ab634c07723b8242e078f3ae9017486277d6690c4",
  darwin_amd64:
    "0a4441f6aaf37bb18cbaf5c7538f9be638f0d93eb325d285b4b452d014a7737a",
  darwin_arm64:
    "6b9e2ff8102c469added7be28cd5cfc2c5a8f7fc3be2df8fe9ee5458d84a1305",
};
const platform = `${process.platform}_${{ x64: "amd64", arm64: "arm64" }[process.arch]}`;
if (!hashes[platform])
  throw new Error("Terraform bitte für diese Plattform manuell installieren.");
const directory = new URL("../.tools/", import.meta.url);
await mkdir(directory, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "rootpilot-terraform-"));
try {
  const archive = join(temporary, "terraform.zip");
  execFileSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--proto",
      "=https",
      "--tlsv1.2",
      "--max-time",
      "120",
      "--output",
      archive,
      `https://releases.hashicorp.com/terraform/${version}/terraform_${version}_${platform}.zip`,
    ],
    { stdio: "inherit" },
  );
  const bytes = await readFile(archive);
  if (createHash("sha256").update(bytes).digest("hex") !== hashes[platform])
    throw new Error(
      "Terraform-Prüfsumme stimmt nicht überein; Installation gestoppt.",
    );
  execFileSync("unzip", ["-q", archive, "terraform", "-d", temporary]);
  const staging = new URL(`terraform-${process.pid}.tmp`, directory);
  await writeFile(staging, await readFile(join(temporary, "terraform")), {
    mode: 0o755,
  });
  await rename(staging, new URL("terraform", directory));
  console.log(
    `Terraform ${version} mit SHA-256-Prüfung unter .tools/terraform installiert.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
