const {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  systemPreferences,
  ipcMain,
  dialog,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "permitted",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);
let win;
const trusted = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === "permitted:" && x.hostname === "world";
  } catch {
    return false;
  }
};
app.whenReady().then(() => {
  const root = path.resolve(__dirname, "../dist");
  protocol.handle("permitted", (request) => {
    const u = new URL(request.url);
    if (u.hostname !== "world")
      return new Response("Forbidden", { status: 403 });
    let file;
    try {
      file = path.resolve(
        root,
        "." +
          decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname),
      );
    } catch {
      return new Response("Bad path", { status: 400 });
    }
    if (!file.startsWith(root + path.sep))
      return new Response("Forbidden", { status: 403 });
    if (!fs.existsSync(file))
      return new Response("Missing local resource", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      contents === win?.webContents &&
      permission === "media" &&
      trusted(origin) &&
      details.mediaType === "video",
  );
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      callback(
        contents === win?.webContents &&
          trusted(details.requestingUrl) &&
          permission === "media" &&
          !!details.mediaTypes?.length &&
          details.mediaTypes.every((t) => t === "video"),
      );
    },
  );
  ipcMain.handle("camera:request", async (event) => {
    if (event.sender !== win?.webContents || !trusted(event.senderFrame.url))
      return false;
    if (process.platform === "darwin")
      return systemPreferences.askForMediaAccess("camera");
    return true;
  });
  const create = () => {
    win = new BrowserWindow({
      width: 1440,
      height: 1000,
      minWidth: 800,
      minHeight: 640,
      backgroundColor: "#091923",
      title: "界限 / THE PERMITTED WORLD",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (!trusted(url)) event.preventDefault();
    });
    win.webContents.on("render-process-gone", () =>
      dialog.showErrorBox(
        "画面进程意外结束",
        "请关闭并重新打开《界限》。鼠标模式无需摄像头。",
      ),
    );
    win
      .loadURL("permitted://world/")
      .catch((e) => dialog.showErrorBox("本地资源加载失败", String(e)));
  };
  create();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) create();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
