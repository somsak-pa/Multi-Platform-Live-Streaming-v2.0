// src/types.ts
import { ReactNode } from 'react';

export type Product = {
    id: number;
    name: string;
    price: number;
    category: 'general' | 'featured' | 'sale';
    icon: string;
};

export type Comment = {
    id: number;
    platform: string;
    user: string;
    text: string;
    icon: ReactNode;
    color: string;
};

export type OBSScene = {
  sceneName: string;
};

export type OBSSource = {
  sceneItemId: number;
  sourceName: string;
  sceneItemEnabled: boolean;
};

export type OBSAudioInput = {
    inputName: string;
    inputMuted: boolean;
    inputVolumeDb: number;
    inputLevels: number[][]; // เพิ่มส่วนนี้เพื่อให้สมบูรณ์
};

export type AppState = {
    obsStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
    isStreaming: boolean;
    streamTime: string;
    viewerCount: number;
    products: Product[];
    selectedProductId: number | null;
    // activePlatforms: Set<string>; // ลบออก - ไม่ได้ใช้แล้ว
    comments: Comment[];
    analytics: {
        totalViewers: number;
        peakViewers: number;
        totalComments: number;
    };
    runningText: string;
    streamTitle: string;
    activeRightTab: 'comments' | 'analytics' | 'settings' | 'channels';
    overlayProduct: Product | null;
    scenes: OBSScene[];
    currentSceneName: string | null;
    sources: OBSSource[];
    audioInputs: OBSAudioInput[];
    restreamChannels: RestreamChannel[];
};

// เพิ่ม Action Type สำหรับ useReducer (ถ้าต้องการรวมไว้ใน types.ts)
export type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_OBS_STATUS'; payload: AppState['obsStatus'] }
  | { type: 'SET_STREAM_STATE'; payload: boolean }
  | { type: 'UPDATE_TIMER'; payload: string }
  | { type: 'RESET_OBS_DATA' }
  | { type: 'SET_OBS_DATA'; payload: { scenes: OBSScene[], currentSceneName: string, sources: OBSSource[], audioInputs: Omit<OBSAudioInput, 'inputLevels'>[] } }
  | { type: 'UPDATE_SOURCE_VISIBILITY'; payload: { sceneItemId: number; sceneItemEnabled: boolean } }
  | { type: 'UPDATE_MUTE_STATE'; payload: { inputName: string; inputMuted: boolean } }
  | { type: 'SET_CURRENT_SCENE'; payload: string }
  | { type: 'UPDATE_AUDIO_LEVELS'; payload: { inputName: string, levels: number[][] } }
  | { type: 'SET_RESTREAM_CHANNELS'; payload: RestreamChannel[] }
  | { type: 'UPDATE_RESTREAM_CHANNEL_STATUS'; payload: { channelId: number, enabled: boolean } }; // เพิ่ม Action ใหม่

// src/types.ts
export type RestreamChannel = {
    id: number;
    name: string; // เช่น "TO SH", "TOSH"
    platform: string; // เช่น "Facebook", "YouTube" (ชื่อที่ map จาก ID)
    status: 'online' | 'offline'; // มาจาก channel.enabled ของ API
    enabled: boolean; // เพิ่ม field enabled ให้ตรงกับ API response
    streamingPlatformId: number; // เพิ่ม field นี้เพื่อใช้ map platform name
    url?: string;
    identifier?: string;
    embedUrl?: string;
    displayName?: string; // ถ้ายังต้องการเก็บ raw displayName
    privacy?: 'public' | 'private' | string;
    isPrimary?: boolean; // ✅ เพิ่ม Prop นี้เข้ามา (เป็น boolean)
    stream_url: string;
};