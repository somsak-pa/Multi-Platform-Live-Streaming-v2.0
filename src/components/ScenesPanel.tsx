import { FC } from 'react';
import { FaTrash, FaPlus } from 'react-icons/fa6';
// ✅ แก้ไขตรงนี้: Import Type Definitions จากไฟล์ types.ts
import { OBSScene } from '../types'; // ตรวจสอบ path ให้ถูกต้อง


// ====================================================================
// Sub-components
// ====================================================================
export const ScenesPanel: FC<{
    scenes: OBSScene[];
    currentSceneName: string | null;
    onSceneSelect: (sceneName: string) => void;
    onAddScene: () => void; // ต้องรับ prop นี้
    onRemoveScene: (sceneName: string) => void; // ต้องรับ prop นี้
}> = ({ scenes, currentSceneName, onSceneSelect, onAddScene, onRemoveScene }) => ( // รับ props ให้ครบถ้วน
    <div className="flex-[1_1_25% bg-gray-200 dark:bg-gray-800 p-2 rounded-lg flex flex-col">
        <div className="flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700">
            <h4 className="font-bold text-gray-800 dark:text-gray-200">Scenes</h4>
        </div>
        <div className="flex-grow overflow-y-auto mt-2 space-y-1">
            {scenes.length > 0 ? (
                scenes.map((scene) => (
                    <div
                        key={scene.sceneName}
                        className={`flex items-center justify-between p-2 rounded-md transition-colors ${currentSceneName === scene.sceneName ? 'bg-blue-600 text-white' : 'hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        <button
                            onClick={() => onSceneSelect(scene.sceneName)}
                            className="flex-grow text-left font-medium p-1"
                        >
                            {scene.sceneName}
                        </button>
                        {currentSceneName !== scene.sceneName && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveScene(scene.sceneName); }}
                                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full ml-2">
                                <FaTrash />
                            </button>
                        )}
                    </div>
                ))) : (
                    <p className="text-gray-500 dark:text-gray-400">ไม่มี Scene</p>
                )
            }
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">

            <button onClick={onAddScene} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center">
                <FaPlus className="mr-2" /> เพิ่ม Scene
            </button>
        </div>
    </div>
);
