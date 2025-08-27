const { contextBridge, ipcRenderer } = require("electron");
console.log("Preload script loaded successfully!");
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
  // ถ้ามีฟังก์ชันอื่นก็เพิ่มตรงนี้
});
