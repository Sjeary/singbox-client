import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");

const platform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
const isWindows = platform === "windows";

const names = {
  singbox: isWindows ? "sing-box.exe" : "sing-box",
  frpc: isWindows ? "frpc.exe" : "frpc",
};

const outputDir = path.join(projectRoot, "build", "bin");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function candidates(fileName) {
  return [
    path.join(outputDir, fileName),
    path.join(workspaceRoot, "v2", "assets", platform, fileName),
    path.join(projectRoot, "..", "v2", "assets", platform, fileName),
    path.join(workspaceRoot, "frp_0.65.0_windows_amd64", fileName),
    path.join(workspaceRoot, fileName),
  ];
}

async function copyOne(label, fileName) {
  const dest = path.join(outputDir, fileName);

  for (const candidate of candidates(fileName)) {
    if (await exists(candidate)) {
      if (path.resolve(candidate) === path.resolve(dest)) {
        console.log(`[assets] ${label}: using existing ${dest}`);
        return;
      }
      await fs.copyFile(candidate, dest);
      if (!isWindows) {
        await fs.chmod(dest, 0o755);
      }
      console.log(`[assets] ${label}: ${candidate} -> ${dest}`);
      return;
    }
  }

  throw new Error(`未找到 ${label} 二进制: ${fileName}。请放到 v2/assets/${platform}/`);
}

async function main() {
  await ensureDir(outputDir);
  await copyOne("sing-box", names.singbox);

  if ((await exists(path.join(workspaceRoot, "v2", "assets", platform, names.frpc))) || isWindows) {
    try {
      await copyOne("frpc", names.frpc);
    } catch (err) {
      console.warn(`[assets] frpc 未准备，Receiver 模式将无法运行: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
