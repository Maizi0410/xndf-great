const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  requestCamera: () => ipcRenderer.invoke("camera:request"),
});
