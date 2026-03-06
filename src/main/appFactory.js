const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { Backend } = require("./backend");

function getEventWindow(event, fallbackWindow) {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && !senderWindow.isDestroyed()) {
    return senderWindow;
  }
  return fallbackWindow && !fallbackWindow.isDestroyed() ? fallbackWindow : null;
}

function parseModeArg(argv) {
  const modeArg = (argv || []).find((item) => String(item).startsWith("--mode="));
  const value = modeArg ? String(modeArg).split("=")[1] : "";
  return value === "sender" || value === "receiver" ? value : null;
}

function normalizeMode(baseMode, argv) {
  if (baseMode === "sender" || baseMode === "receiver") {
    return baseMode;
  }
  const argMode = parseModeArg(argv);
  return argMode || "all";
}

function createElectronApp(baseMode = "all") {
  let mainWindow = null;
  let profileWindow = null;
  let backend = null;
  let appMode = normalizeMode(baseMode, process.argv);

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 860,
      minHeight: 620,
      title: "网络连接助手",
      backgroundColor: "#0b1220",
      frame: false,
      autoHideMenuBar: true,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    mainWindow.removeMenu();
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  function assertMode(need) {
    if (appMode === "all") return;
    if (appMode !== need) {
      throw new Error(`当前为 ${appMode} 模式，不支持 ${need} 操作`);
    }
  }

  function registerIpc() {
    ipcMain.handle("settings:load", () => backend.loadSettings());
    ipcMain.handle("settings:save", (_event, settings) => backend.saveSettings(settings));
    ipcMain.handle("service:status", () => backend.getStatus());
    ipcMain.handle("app:paths", () => backend.getPaths());
    ipcMain.handle("app:device-info", () => backend.getDeviceInfo());
    ipcMain.handle("app:mode", () => appMode);

    ipcMain.handle("profile:open", (_event, payload) => {
      if (profileWindow && !profileWindow.isDestroyed()) {
        profileWindow.focus();
        return true;
      }

      profileWindow = new BrowserWindow({
        width: 900,
        height: 680,
        minWidth: 760,
        minHeight: 560,
        title: "个人资料",
        parent: mainWindow || undefined,
        modal: false,
        backgroundColor: "#0b1220",
        frame: false,
        autoHideMenuBar: true,
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      const query = {
        serverUrl: String(payload?.serverUrl || ""),
        token: String(payload?.token || ""),
        username: String(payload?.username || ""),
      };

      profileWindow.removeMenu();
      profileWindow.loadFile(path.join(__dirname, "../renderer/profile.html"), { query });
      profileWindow.on("closed", () => {
        profileWindow = null;
      });
      return true;
    });

    ipcMain.on("profile:updated", (_event, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("profile:updated", payload || {});
      }
    });

    ipcMain.handle("window:minimize", (event) => {
      const targetWindow = getEventWindow(event, mainWindow);
      if (targetWindow) {
        targetWindow.minimize();
      }
      return true;
    });

    ipcMain.handle("window:toggle-maximize", (event) => {
      const targetWindow = getEventWindow(event, mainWindow);
      if (targetWindow) {
        if (targetWindow.isMaximized()) {
          targetWindow.unmaximize();
          return false;
        }
        targetWindow.maximize();
        return true;
      }
      return false;
    });

    ipcMain.handle("window:close", (event) => {
      const targetWindow = getEventWindow(event, mainWindow);
      if (targetWindow) {
        targetWindow.close();
      }
      return true;
    });

    ipcMain.handle("window:is-maximized", (event) => {
      const targetWindow = getEventWindow(event, mainWindow);
      if (!targetWindow) return false;
      return targetWindow.isMaximized();
    });

    ipcMain.handle("sender:start", (_event, senderSettings) => {
      assertMode("sender");
      return backend.startSender(senderSettings);
    });
    ipcMain.handle("sender:stop", () => {
      assertMode("sender");
      backend.stopSender();
      return backend.getStatus();
    });

    ipcMain.handle("receiver:start", (_event, receiverSettings) => {
      assertMode("receiver");
      return backend.startReceiver(receiverSettings);
    });
    ipcMain.handle("receiver:stop", () => {
      assertMode("receiver");
      backend.stopReceiver();
      return backend.getStatus();
    });
  }

  app.whenReady().then(() => {
    backend = new Backend(app, () => mainWindow, appMode);
    backend.init();

    registerIpc();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("before-quit", () => {
    if (backend) backend.stopAll();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

module.exports = {
  createElectronApp,
};
