// src/components/SettingsTab.tsx
import React, { useState, FC } from 'react';
import { FaChevronDown, FaEye, FaEyeSlash,} from 'react-icons/fa6';
import { AppState } from '../types'; // นำเข้า AppState
import { FaFacebookF, FaYoutube, FaTiktok, FaInstagram, FaShopware, FaSatelliteDish } from 'react-icons/fa6';
// UI Components (ย้ายมาจาก App.tsx)
// เพื่อให้ SettingsTab ไม่ต้องใหญ่เกินไป เราอาจแยกเป็น Sub-components ภายในนี้อีกที
const OBSSettings: FC<{
    status: AppState['obsStatus'];
    onConnect: (ip: string, port: string, pass:string, save: boolean) => void;
    onDisconnect: () => void;
}> = ({ status, onConnect, onDisconnect }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [ip, setIp] = useState(() => localStorage.getItem('obs-ip') || '127.0.0.1');
    const [port, setPort] = useState(() => localStorage.getItem('obs-port') || '4455');
    const [password, setPassword] = useState(() => (localStorage.getItem('obs-save-password') === 'true' ? localStorage.getItem('obs-password') : '') || '');
    const [savePassword, setSavePassword] = useState(() => localStorage.getItem('obs-save-password') === 'true');
    const [showPassword, setShowPassword] = useState(false);

    const handleConnectToggle = () => {
        if (status === 'connected') onDisconnect();
        else onConnect(ip, port, password, savePassword);
    };

    const statusMap = {
        connected: { text: 'Connected', color: 'bg-green-500', btnText: 'ตัดการเชื่อมต่อ', btnColor: 'bg-red-600 hover:bg-red-700' },
        connecting: { text: 'Connecting...', color: 'bg-yellow-500 animate-pulse', btnText: 'กำลังเชื่อมต่อ...', btnColor: 'bg-blue-600' },
        failed: { text: 'Failed', color: 'bg-red-500', btnText: 'เชื่อมต่อ', btnColor: 'bg-blue-600 hover:bg-blue-700' },
        disconnected: { text: 'Disconnected', color: 'bg-gray-400', btnText: 'เชื่อมต่อ', btnColor: 'bg-blue-600 hover:bg-blue-700' }
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center font-semibold text-left">
                <span>ตั้งค่าการเชื่อมต่อ OBS</span>
                <FaChevronDown className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="obs-ip" className="block mb-1 font-semibold text-sm">IP Address:</label>
                            <input
                                type="text"
                                id="obs-ip"
                                value={ip}
                                onChange={e => setIp(e.target.value)}
                                placeholder="127.0.0.1"
                                className="p-2 bg-white dark:bg-gray-800 rounded-md border text-sm w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="obs-port" className="block mb-1 font-semibold text-sm">Port:</label>
                            <input
                                type="number"
                                id="obs-port"
                                value={port}
                                onChange={e => setPort(e.target.value)}
                                placeholder="4455"
                                className="p-2 bg-white dark:bg-gray-800 rounded-md border text-sm w-full"
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label htmlFor="obs-password" className="text-sm font-medium">Password:</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="obs-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full p-2 mt-1 bg-white dark:bg-gray-800 rounded-md border pr-10 text-sm"
                        />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-gray-400 hover:text-gray-600">{showPassword ? <FaEyeSlash /> : <FaEye />}</button>
                    </div>
                    <div className="flex items-center"><input id="save-pass" type="checkbox" checked={savePassword} onChange={e => setSavePassword(e.target.checked)} className="h-4 w-4 rounded" /><label htmlFor="save-pass" className="ml-2 text-sm">จดจำรหัสผ่าน</label></div>
                    <button onClick={handleConnectToggle} disabled={status === 'connecting'} className={`w-full font-bold py-2 px-4 rounded-lg text-sm text-white ${statusMap[status].btnColor} disabled:opacity-50`}>{statusMap[status].btnText}</button>
                </div>
            )}
        </div>
    );
};

const PlatformDestinationSettings: FC<{onOpen: (platform: string) => void}> = ({onOpen}) => {
    const platforms = [
        { id: 'facebook', icon: <FaFacebookF className="text-blue-500" /> }, // Add import for FaFacebookF if not present
        { id: 'youtube', icon: <FaYoutube className="text-red-500" /> }, // Add import for FaYoutube if not present
        { id: 'tiktok', icon: <FaTiktok className="text-black dark:text-white" /> }, // Add import for FaTiktok if not present
        { id: 'instagram', icon: <FaInstagram className="text-pink-500" /> }, // Add import for FaInstagram if not present
        { id: 'shopee', icon: <FaShopware className="text-orange-500" /> }, // Add import for FaShopware if not present
        { id: 'custom', icon: <FaSatelliteDish className="text-teal-400" /> },
    ];
    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">ตั้งค่าปลายทาง (Stream Destination)</h3>
            <div className="flex flex-wrap gap-3 justify-start text-2xl">
                {platforms.map(p => <button key={p.id} onClick={() => onOpen(p.id)} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{p.icon}</button>)}
            </div>
        </div>
    );
};

const DisplaySettings: FC<{streamTitle: string; runningText: string; onStreamTitleChange: (text: string) => void; onRunningTextChange: (text: string) => void; onUpdate: () => void}> = ({ streamTitle, runningText, onStreamTitleChange, onRunningTextChange, onUpdate }) => (
    <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">ตั้งค่าการแสดงผล</h3>
        <div>
            <label htmlFor="stream-title-input" className="block mb-2 font-semibold">ชื่อเรื่องไลฟ์</label>
            <input type="text" id="stream-title-input" value={streamTitle} onChange={e => onStreamTitleChange(e.target.value)} placeholder="ใส่ชื่อเรื่องของไลฟ์สตรีม" className="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border" />
        </div>
        <div className="mt-4">
            <label htmlFor="running-text-input" className="block mb-2 font-semibold">ข้อความวิ่ง</label>
            <textarea id="running-text-input" value={runningText} onChange={e => onRunningTextChange(e.target.value)} rows={2} className="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border"></textarea>
            <button onClick={onUpdate} className="mt-2 w-full p-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg">อัปเดตข้อความ</button>
        </div>
    </div>
);


interface SettingsTabProps {
    obsStatus: AppState['obsStatus'];
    runningText: string;
    streamTitle: string;
    onConnectOBS: (ip: string, port: string, pass: string, save: boolean) => void;
    onDisconnectOBS: () => void;
    onUpdateRunningText: (text: string) => void;
    onUpdateStreamTitle: (title: string) => void;
    onOpenPlatformSettings: (platform: string) => void;
    onSetModal: React.Dispatch<React.SetStateAction<{ type: 'alert' | 'confirm' | 'product' | 'settings' | null; props?: any }>>;
    onFetchRestreamChannels: () => void; // เพิ่มเข้ามาสำหรับ Refresh Restream Token (ถ้ามี)
}

const SettingsTab: FC<SettingsTabProps> = (props) => {
    const { obsStatus, runningText, streamTitle, onConnectOBS, onDisconnectOBS, onUpdateRunningText, onUpdateStreamTitle, onOpenPlatformSettings, onSetModal} = props;
    const [localRunningText, setLocalRunningText] = useState(runningText);

    // --- ฟังก์ชันสำหรับเชื่อมต่อ Restream (อยู่ใน App.tsx) ---
    const handleConnectRestream = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/restream');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                onSetModal({ type: 'alert', props: { message: 'ไม่สามารถสร้าง URL สำหรับเชื่อมต่อ Restream ได้', alertType: 'error' } });
            }
        } catch (error) {
            console.error('Error initiating Restream OAuth:', error);
            onSetModal({ type: 'alert', props: { message: 'เกิดข้อผิดพลาดในการเริ่มต้นเชื่อมต่อ Restream', alertType: 'error' } });
        }
    };
    // ------------------------------------------

    return (
        <div className="space-y-6">
            <OBSSettings onConnect={onConnectOBS} onDisconnect={onDisconnectOBS} status={obsStatus} />

            {/* --- ส่วนใหม่สำหรับ Restream Integration --- */}
            <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">เชื่อมต่อ Restream.io</h3>
                <button
                    onClick={handleConnectRestream}
                    className="w-full font-bold py-2 px-4 rounded-lg text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                    เชื่อมต่อบัญชี Restream
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    เชื่อมต่อบัญชี Restream.io ของคุณเพื่อดึงข้อมูลช่องสตรีมและสถานะต่างๆ
                </p>
            </div>
            {/* ------------------------------------------ */}

            <PlatformDestinationSettings onOpen={onOpenPlatformSettings} />
            <DisplaySettings
                streamTitle={streamTitle}
                runningText={localRunningText}
                onStreamTitleChange={onUpdateStreamTitle}
                onRunningTextChange={setLocalRunningText}
                onUpdate={() => {
                    onUpdateRunningText(localRunningText);
                    onSetModal({type: 'alert', props: { message: 'อัปเดตข้อความวิ่งแล้ว', alertType: 'success' }});
                }}
            />
        </div>
    );
};

export default SettingsTab;