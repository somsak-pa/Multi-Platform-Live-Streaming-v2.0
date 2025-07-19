// ObsManagementPanel.tsx
import { FC } from 'react';

import {
    FaEye, FaEyeSlash, FaImage, FaDesktop, FaPlus, FaTrash
} from 'react-icons/fa6';
import {
    FaVolumeUp, FaVolumeMute
} from 'react-icons/fa';

// Type definitions (อัปเดตให้ตรงกับใน App.tsx)
// ✅ นำเข้าจากไฟล์ types.ts แทนการประกาศซ้ำ
import { OBSScene, OBSSource, OBSAudioInput } from '../types';

interface ObsManagementPanelProps {
    scenes: OBSScene[];
    currentSceneName: string | null;
    sources: OBSSource[];
    audioInputs: OBSAudioInput[];
    onSceneSelect: (sceneName: string) => void;
    onToggleVisibility: (sceneName: string | null, sceneItemId: number, isVisible: boolean) => void;
    onToggleMute: (inputName: string, isMuted: boolean) => void;
    onAddScene: () => void;
    onRemoveScene: (sceneName: string) => void;
}

// ====================================================================
// Sub-components (ย้ายมาอยู่ในไฟล์นี้ หรือสร้างเป็นไฟล์แยกในโฟลเดอร์ย่อย)
// ====================================================================

const ScenesPanel: FC<{
    scenes: OBSScene[];
    currentSceneName: string | null;
    onSceneSelect: (sceneName: string) => void;
    onAddScene: () => void;
    onRemoveScene: (sceneName: string) => void;
}> = ({ scenes, currentSceneName, onSceneSelect, onAddScene, onRemoveScene }) => (
  <div className="flex-[1_1_25%] bg-gray-200 dark:bg-gray-800 p-1 rounded-lg flex flex-col text-xs">
    <div className="flex justify-between items-center p-1 border-b border-gray-300 dark:border-gray-700">
        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Scenes</h4>
    </div>
    <div className="flex-grow overflow-y-auto pr-1 space-y-0.5 custom-scrollbar max-h-36">
      {scenes.length > 0 ? (
        scenes.map((scene) => (
            <div
                key={scene.sceneName}
                className={`flex items-center justify-between py-0.5 px-1 rounded-md transition-colors ${currentSceneName === scene.sceneName ? 'bg-blue-600 text-white' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              <button
                  onClick={() => onSceneSelect(scene.sceneName)}
                  className="flex-grow text-left font-medium p-0.5 text-xs"
              >
                {scene.sceneName}
              </button>
              {currentSceneName !== scene.sceneName && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemoveScene(scene.sceneName); }}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full ml-0.5 text-xs"
                >
                    <FaTrash />
                </button>
              )}
            </div>
          ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400 p-1 text-xs">ไม่มี Scene</p>
      )}
    </div>
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onAddScene} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-0.5 px-1 rounded-lg flex items-center justify-center text-xs">
            <FaPlus className="mr-0.5 text-xs" /> เพิ่ม Scene
        </button>
    </div>
  </div>
);

const SourcesPanel: FC<{
    sources: OBSSource[];
    currentSceneName: string | null;
    onToggleVisibility: (sceneName: string | null, sceneItemId: number, isVisible: boolean) => void;
}> = ({ sources, currentSceneName, onToggleVisibility }) => (
    <div className="flex-[1_1_25%] bg-gray-200 dark:bg-gray-800 p-1 rounded-lg flex flex-col text-xs">
        <div className="flex justify-between items-center p-1 border-b border-gray-300 dark:border-gray-700">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Sources</h4>
        </div>
        <div className="flex-grow overflow-y-auto mt-1 space-y-0.5 pr-1 custom-scrollbar max-h-36">
            {sources.length > 0 ? (
                sources.map((source) => (
                    <div key={source.sceneItemId} className="flex items-center justify-between py-0.5 px-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                        <span className="flex items-center gap-0.5 text-gray-800 dark:text-gray-200 text-xs">
                            {source.sourceName.toLowerCase().includes('image') ? <FaImage className="text-sm"/> : <FaDesktop className="text-sm" />}
                            {source.sourceName}
                        </span>
                        <button onClick={() => onToggleVisibility(currentSceneName, source.sceneItemId, source.sceneItemEnabled)} className="text-gray-600 dark:text-gray-400 hover:text-white text-xs">
                            {source.sceneItemEnabled ? <FaEye /> : <FaEyeSlash />}
                        </button>
                    </div>
                ))) : (
                    <p className="text-gray-500 dark:text-gray-400 p-1 text-xs">ไม่มี Source ใน Scene ปัจจุบัน</p>
                )
            }
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button disabled className="w-full bg-gray-600 opacity-50 cursor-not-allowed text-white font-bold py-0.5 px-1 rounded-lg flex items-center justify-center text-xs">
                <FaPlus className="mr-0.5 text-xs" /> เพิ่ม Source (ยังไม่เปิดใช้งาน)
            </button>
        </div>
    </div>
);

const VUMeter: FC<{ levels: number[][] }> = ({ levels }) => {
    const dbToPercentage = (db: number) => {
        if (db < -60) return 0;
        if (db > 0) return 100;
        return (1 - (db / -60)) * 100;
    };

    const avgLevelDb = levels[0]?.[0] ?? -60;
    const peakLevelDb = levels[0]?.[1] ?? -60;

    const avgPercent = dbToPercentage(avgLevelDb);
    const peakPercent = dbToPercentage(peakLevelDb);

    const getBarColor = (percent: number) => {
        if (percent > 90) return 'bg-red-500';
        if (percent > 75) return 'bg-yellow-400';
        return 'bg-green-500';
    };

    return (
        <div className="w-full bg-gray-600/50 rounded-full h-1 relative overflow-hidden">
            <div
                className={`h-full transition-all duration-50 ${getBarColor(avgPercent)}`}
                style={{ width: `${avgPercent}%` }}
            ></div>
            <div
                className="absolute top-0 h-full bg-yellow-200 w-px"
                style={{ left: `${peakPercent}%` }}
            ></div>
        </div>
    );
};


const AudioMixerPanel: FC<{
    audioInputs: OBSAudioInput[];
    onToggleMute: (inputName: string, isMuted: boolean) => void;
}> = ({ audioInputs, onToggleMute }) => {
    // console.log('[DEBUG] AudioMixerPanel received audioInputs:', audioInputs); // ลด log
    return (
        <div className="flex-[1_1_25%] bg-gray-200 dark:bg-gray-800 p-1 rounded-lg flex flex-col text-xs">
            <div className="flex justify-between items-center p-1 border-b border-gray-300 dark:border-gray-700">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Audio Mixer</h4>
            </div>
            <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar max-h-36">
                {audioInputs.length > 0 ? (
                    audioInputs.map(input => (
                        <div key={input.inputName} className="mb-0.5">
                            <div className="flex justify-between items-center text-xs mb-0.5">
                                <span className="text-gray-800 dark:text-gray-200">{input.inputName}</span>
                                <span className="text-gray-600 dark:text-gray-400">{input.inputVolumeDb !== -100 ? `${input.inputVolumeDb.toFixed(1)} dB` : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => onToggleMute(input.inputName, input.inputMuted)} className="text-xs text-gray-600 dark:text-gray-400">
                                    {input.inputMuted ? <FaVolumeMute className="text-red-500"/> : <FaVolumeUp />}
                                </button>
                                {/* ตรวจสอบว่า input.inputLevels มีค่า ก่อนส่งให้ VUMeter */}
                                <VUMeter levels={input.inputLevels || []} />
                            </div>
                        </div>
                    ))) : (
                        <p className="text-gray-500 dark:text-gray-400 p-1 text-xs">ไม่มี Audio Input</p>
                    )
                }
            </div>
        </div>
    );
};
// ====================================================================
// Main Component
// ====================================================================

export const ObsManagementPanel: FC<ObsManagementPanelProps> = ({
    scenes,
    currentSceneName,
    sources,
    audioInputs,
    onSceneSelect,
    onToggleVisibility,
    onToggleMute,
    onAddScene,
    onRemoveScene
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Scenes Panel */}
            <ScenesPanel
                scenes={scenes}
                currentSceneName={currentSceneName}
                onSceneSelect={onSceneSelect}
                onAddScene={onAddScene}
                onRemoveScene={onRemoveScene}
            />

            {/* Sources Panel */}
            <SourcesPanel
                sources={sources}
                currentSceneName={currentSceneName}
                onToggleVisibility={onToggleVisibility}
            />

            {/* Audio Mixer Panel */}
            <AudioMixerPanel
                audioInputs={audioInputs}
                onToggleMute={onToggleMute}
            />
        </div>
    );
};