const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const os = require("node:os");

const DEFAULT_TARGET_DOMAINS = [
  "chatgpt.com",
  "openai.com",
  "auth0.com",
  "oaistatic.com",
  "oaiusercontent.com",
  "gravatar.com",
  "cloudflare.com",
  "wp.com",
];

const DEFAULT_SETTINGS = {
  sender: {
    proxy_server: "47.113.226.118",
    proxy_port: "50000",
    proxy_uuid: "9C4A7CF0-C21A-4B95-A704-993CC1D95EB2",
    socks_listen_port: "19872",
    fallback_mode: "system_proxy",
    fallback_local_port: "7890",
    target_domains: DEFAULT_TARGET_DOMAINS.join(","),
  },
  receiver: {
    frps_server: "47.113.226.118",
    frps_port: "7000",
    frps_token: "11112222",
    remote_port: "50000",
    vmess_listen_port: "3001",
    vmess_uuid: "9C4A7CF0-C21A-4B95-A704-993CC1D95EB2",
    forward_proxy_port: "7890",
    tls_enable: true,
    use_compression: true,
    use_encryption: true,
  },
  collab: {
    server_url: "http://47.113.226.118:8088",
    last_username: "demo_user",
    last_avatar: "",
    pinned_users: [],
  },
};

function isWindows() {
  return process.platform === "win32";
}

function binaryName(stem) {
  return isWindows() ? `${stem}.exe` : stem;
}

function toInt(value, name) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`${name} 必须是 1~65535 的整数`);
  }
  return n;
}

class Backend {
  constructor(app, getWindow, appMode = "all") {
    this.app = app;
    this.getWindow = getWindow;
    this.appMode = appMode;

    this.settingsFile = path.join(this.app.getPath("userData"), "settings.json");
    this.runtimeDir = path.join(this.app.getPath("userData"), "runtime");

    this.senderProcess = null;
    this.receiverFrpc = null;
    this.receiverSingbox = null;
  }

  init() {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
  }

  log(source, line) {
    const window = this.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("log:line", { source, line });
    }
  }

  resolveBinary(stem) {
    const filename = binaryName(stem);
    const workspaceRoot = path.resolve(__dirname, "../../..");

    const candidates = this.app.isPackaged
      ? [path.join(process.resourcesPath, "bin", filename)]
      : [
          path.join(workspaceRoot, "v3_electron", "build", "bin", filename),
          path.join(workspaceRoot, "v2", "assets", "windows", filename),
          path.join(workspaceRoot, "frp_0.65.0_windows_amd64", filename),
          path.join(workspaceRoot, filename),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        if (!isWindows()) {
          fs.chmodSync(candidate, 0o755);
        }
        return candidate;
      }
    }

    return candidates[0];
  }

  loadSettings() {
    if (!fs.existsSync(this.settingsFile)) {
      return structuredClone(DEFAULT_SETTINGS);
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.settingsFile, "utf-8"));
      return {
        sender: { ...DEFAULT_SETTINGS.sender, ...(raw.sender || {}) },
        receiver: { ...DEFAULT_SETTINGS.receiver, ...(raw.receiver || {}) },
        collab: { ...DEFAULT_SETTINGS.collab, ...(raw.collab || {}) },
      };
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  saveSettings(data) {
    const merged = {
      sender: { ...DEFAULT_SETTINGS.sender, ...(data.sender || {}) },
      receiver: { ...DEFAULT_SETTINGS.receiver, ...(data.receiver || {}) },
      collab: { ...DEFAULT_SETTINGS.collab, ...(data.collab || {}) },
    };
    fs.writeFileSync(this.settingsFile, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }

  getPaths() {
    return {
      singbox: this.resolveBinary("sing-box"),
      frpc: this.resolveBinary("frpc"),
      runtimeDir: this.runtimeDir,
      userDataDir: this.app.getPath("userData"),
    };
  }

  getDeviceInfo() {
    const interfaces = os.networkInterfaces();
    const ipv4List = [];

    for (const records of Object.values(interfaces)) {
      if (!Array.isArray(records)) continue;
      for (const item of records) {
        if (!item) continue;
        if (item.family !== "IPv4") continue;
        if (item.internal) continue;
        ipv4List.push(item.address);
      }
    }

    const uniqueIpv4 = [...new Set(ipv4List)];

    return {
      hostname: os.hostname(),
      ipv4List: uniqueIpv4,
      preferredIpv4: uniqueIpv4[0] || "127.0.0.1",
    };
  }

  getStatus() {
    return {
      senderRunning: !!this.senderProcess,
      receiverFrpcRunning: !!this.receiverFrpc,
      receiverSingboxRunning: !!this.receiverSingbox,
    };
  }

  spawnProcess(source, cmd, args) {
    const child = spawn(cmd, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (buf) => {
      this.log(source, String(buf).trim());
    });

    child.stderr.on("data", (buf) => {
      this.log(source, String(buf).trim());
    });

    child.on("exit", (code) => {
      this.log(source, `进程退出，code=${code}`);
      if (source === "sender") this.senderProcess = null;
      if (source === "receiver-frpc") this.receiverFrpc = null;
      if (source === "receiver-singbox") this.receiverSingbox = null;
      this.emitStatus();
    });

    return child;
  }

  emitStatus() {
    const window = this.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("service:status", this.getStatus());
    }
  }

  stopChild(child, source) {
    if (!child) return;
    try {
      child.kill();
      this.log(source, "已停止");
    } catch (err) {
      this.log(source, `停止失败: ${err.message}`);
    }
  }

  stopSender() {
    this.stopChild(this.senderProcess, "sender");
    this.senderProcess = null;
    this.emitStatus();
  }

  stopReceiver() {
    this.stopChild(this.receiverFrpc, "receiver-frpc");
    this.stopChild(this.receiverSingbox, "receiver-singbox");
    this.receiverFrpc = null;
    this.receiverSingbox = null;
    this.emitStatus();
  }

  stopAll() {
    this.stopSender();
    this.stopReceiver();
  }

  buildSenderConfig(sender) {
    const proxyPort = toInt(sender.proxy_port, "公网端口");
    const listenPort = toInt(sender.socks_listen_port, "本地SOCKS监听端口");
    const fallbackMode = sender.fallback_mode === "direct" ? "direct" : "system_proxy";

    const domainsRaw =
      this.appMode === "sender" ? DEFAULT_TARGET_DOMAINS.join(",") : String(sender.target_domains || "");

    const domains = String(domainsRaw)
      .replace(/\n/g, ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueDomains = [...new Set(domains)];
    const domainSuffix = uniqueDomains.map((d) => d.replace(/^\./, ""));

    const outbounds = [
      {
        type: "vmess",
        tag: "proxy",
        server: String(sender.proxy_server || "").trim(),
        server_port: proxyPort,
        uuid: String(sender.proxy_uuid || "").trim(),
        packet_encoding: "packetaddr",
        transport: {
          type: "ws",
          path: "",
          max_early_data: 2048,
          early_data_header_name: "Sec-WebSocket-Protocol",
        },
      },
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
      { type: "dns", tag: "dns_out" },
    ];

    if (fallbackMode === "system_proxy") {
      outbounds.splice(1, 0, {
        type: "socks",
        tag: "system_proxy",
        server: "127.0.0.1",
        server_port: toInt(sender.fallback_local_port, "本机代理端口"),
      });
    }

    const config = {
      log: { level: "info", timestamp: true },
      dns: {
        servers: [
          {
            tag: "dns_proxy",
            address: "https://1.1.1.1/dns-query",
            address_resolver: "dns_resolver",
            strategy: "ipv4_only",
            detour: "proxy",
          },
          {
            tag: "dns_direct",
            address: "https://dns.alidns.com/dns-query",
            address_resolver: "dns_resolver",
            strategy: "ipv4_only",
            detour: "direct",
          },
          { tag: "dns_local", address: "local" },
          {
            tag: "dns_resolver",
            address: "223.5.5.5",
            strategy: "ipv4_only",
            detour: "direct",
          },
        ],
        rules: [
          { outbound: "dns_resolver", server: "dns_resolver" },
          { clash_mode: "direct", server: "dns_direct" },
          { clash_mode: "global", server: "dns_proxy" },
          ...(domainSuffix.length ? [{ domain_suffix: domainSuffix, server: "dns_proxy" }] : []),
        ],
        final: fallbackMode === "direct" ? "dns_local" : "dns_direct",
      },
      inbounds: [
        {
          type: "socks",
          tag: "socks",
          listen: "127.0.0.1",
          listen_port: listenPort,
          sniff: true,
          sniff_override_destination: true,
        },
      ],
      outbounds,
      route: {
        rules: [
          { protocol: "dns", outbound: "dns_out" },
          ...(uniqueDomains.length
            ? [
                {
                  domain: uniqueDomains,
                  domain_suffix: domainSuffix,
                  outbound: "proxy",
                },
              ]
            : []),
          { ip_is_private: true, outbound: "direct" },
          { outbound: fallbackMode },
        ],
        final: fallbackMode,
        auto_detect_interface: true,
      },
    };

    return config;
  }

  buildReceiverFiles(receiver) {
    const cfg = {
      log: { level: "info", timestamp: true },
      inbounds: [
        {
          type: "vmess",
          tag: "vmess_in",
          listen: "::",
          listen_port: toInt(receiver.vmess_listen_port, "VMess监听端口"),
          users: [{ uuid: String(receiver.vmess_uuid || "").trim() }],
          transport: {
            type: "ws",
            path: "",
            max_early_data: 2048,
            early_data_header_name: "Sec-WebSocket-Protocol",
          },
        },
      ],
      outbounds: [
        {
          type: "socks",
          tag: "forward",
          server: "127.0.0.1",
          server_port: toInt(receiver.forward_proxy_port, "转发端口"),
        },
      ],
      route: { final: "forward", auto_detect_interface: true },
    };

    const frpcIni = [
      "[common]",
      `server_addr = ${String(receiver.frps_server || "").trim()}`,
      `server_port = ${toInt(receiver.frps_port, "FRPS端口")}`,
      `token = ${String(receiver.frps_token || "").trim()}`,
      `tls_enable = ${receiver.tls_enable ? "true" : "false"}`,
      "",
      "[vmess-ws]",
      "type = tcp",
      "local_ip = 127.0.0.1",
      `local_port = ${toInt(receiver.vmess_listen_port, "VMess监听端口")}`,
      `remote_port = ${toInt(receiver.remote_port, "远程端口")}`,
      `use_encryption = ${receiver.use_encryption ? "true" : "false"}`,
      `use_compression = ${receiver.use_compression ? "true" : "false"}`,
      "",
    ].join(os.EOL);

    return { singbox: cfg, frpcIni };
  }

  startSender(settings) {
    this.stopSender();

    const singboxPath = this.resolveBinary("sing-box");
    if (!fs.existsSync(singboxPath)) {
      throw new Error(`未找到 sing-box: ${singboxPath}`);
    }

    const config = this.buildSenderConfig(settings);
    const configPath = path.join(this.runtimeDir, "sender.runtime.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    this.senderProcess = this.spawnProcess("sender", singboxPath, ["run", "-c", configPath]);
    this.log("sender", `使用配置: ${configPath}`);
    this.emitStatus();

    return { configPath, binary: singboxPath };
  }

  startReceiver(settings) {
    this.stopReceiver();

    const singboxPath = this.resolveBinary("sing-box");
    const frpcPath = this.resolveBinary("frpc");

    if (!fs.existsSync(singboxPath)) {
      throw new Error(`未找到 sing-box: ${singboxPath}`);
    }
    if (!fs.existsSync(frpcPath)) {
      throw new Error(`未找到 frpc: ${frpcPath}`);
    }

    const { singbox, frpcIni } = this.buildReceiverFiles(settings);
    const singboxCfgPath = path.join(this.runtimeDir, "receiver.singbox.runtime.json");
    const frpcCfgPath = path.join(this.runtimeDir, "receiver.frpc.runtime.ini");

    fs.writeFileSync(singboxCfgPath, JSON.stringify(singbox, null, 2), "utf-8");
    fs.writeFileSync(frpcCfgPath, frpcIni, "utf-8");

    this.receiverSingbox = this.spawnProcess("receiver-singbox", singboxPath, ["run", "-c", singboxCfgPath]);
    this.receiverFrpc = this.spawnProcess("receiver-frpc", frpcPath, ["-c", frpcCfgPath]);

    this.log("receiver", `sing-box 配置: ${singboxCfgPath}`);
    this.log("receiver", `frpc 配置: ${frpcCfgPath}`);
    this.emitStatus();

    return {
      singboxConfigPath: singboxCfgPath,
      frpcConfigPath: frpcCfgPath,
      singboxBinary: singboxPath,
      frpcBinary: frpcPath,
    };
  }
}

module.exports = {
  Backend,
  DEFAULT_SETTINGS,
};
