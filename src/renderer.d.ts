// src/renderer.d.ts

export interface IElectronAPI {
  invoke: (channel: string, data?: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}