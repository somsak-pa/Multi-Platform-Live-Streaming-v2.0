// preload.js

const { contextBridge, ipcRenderer } = require('electron');
console.log('Preload script loaded successfully!'); // << เพิ่มบรรทัดนี้
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  // ถ้ามีฟังก์ชันอื่นก็เพิ่มตรงนี้
});