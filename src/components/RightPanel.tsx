// src/components/RightPanel.tsx
import { FC } from 'react';
import { FaComments, FaGear, FaGlobe } from 'react-icons/fa6';
import { AppState, Comment as CustomComment, RestreamChannel } from '../types'; // เพิ่ม as CustomComment

// นำเข้า Tab Components
import CommentsTab from './CommentsTab';
// import AnalyticsTab from './AnalyticsTab'; // AnalyticsTab ถูกลบออกไปแล้ว
import SettingsTab from './SettingsTab';
import ChannelsTab from './ChannelsTab'; // นำเข้า ChannelsTab

// *** RightPanelProps ตัวใหม่ ที่มี Props ที่ RightPanel ต้องใช้จริงๆ ***
interface RightPanelProps {
  // Props ที่ RightPanel ใช้เอง (เช่น สำหรับ Tab Selection)
  activeTab: AppState['activeRightTab'];
  setActiveTab: (tab: AppState['activeRightTab']) => void;

  // Props ที่ส่งต่อไปให้ Child Components
  obsStatus: AppState['obsStatus']; // ส่งให้ SettingsTab
  comments: CustomComment[]; // เปลี่ยนเป็น CustomComment[]
  analytics: AppState['analytics']; // ส่งให้ AnalyticsTab (ถ้ามี)
  runningText: string; // ส่งให้ SettingsTab
  streamTitle: string; // ส่งให้ SettingsTab
  onConnectOBS: (ip: string, port: string, pass: string, save: boolean) => void; // ส่งให้ SettingsTab
  onDisconnectOBS: () => void; // ส่งให้ SettingsTab
  onSendComment: (comment: string) => void; // ส่งให้ CommentsTab
  onUpdateRunningText: (text: string) => void; // ส่งให้ SettingsTab
  onUpdateStreamTitle: (title: string) => void; // ส่งให้ SettingsTab
  onOpenPlatformSettings: (platform: string) => void; // ส่งให้ SettingsTab
  onSetModal: React.Dispatch<React.SetStateAction<{ type: 'alert' | 'confirm' | 'product' | 'settings' | null; props?: any }>>; // ส่งให้ SettingsTab
  restreamChannels: RestreamChannel[]; // ส่งให้ ChannelsTab
  onFetchRestreamChannels: () => void; // ส่งให้ ChannelsTab และ SettingsTab (ถ้ามีการรีเฟรช token)
  onToggleRestreamChannel: (channelId: number, currentEnabledState: boolean) => void; // ส่งให้ ChannelsTab

  // isPortraitMode: boolean; // ถ้าคุณยังใช้ prop นี้ใน RightPanel ก็คงต้องเพิ่มกลับ
}

const RightPanel: FC<RightPanelProps> = (props) => {
    const { activeTab, setActiveTab, obsStatus, comments,
            runningText, streamTitle, onConnectOBS, onDisconnectOBS, onSendComment,
            onUpdateRunningText, onUpdateStreamTitle, onOpenPlatformSettings, onSetModal,
            restreamChannels, onFetchRestreamChannels, onToggleRestreamChannel // Destructure props
    } = props; // Destructure props

    const tabs = [
        { id: 'comments', name: 'คอมเมนต์', icon: <FaComments /> },
        { id: 'channels', name: 'ช่องสตรีม', icon: <FaGlobe /> }, // เปลี่ยน Icon
        { id: 'settings', name: 'ตั้งค่า', icon: <FaGear /> },
    ] as const;

    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-btn flex-1 ${activeTab === tab.id ? 'active' : ''}`}>
                        <i className="mr-2">{tab.icon}</i>{tab.name}
                    </button>
                ))}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {activeTab === 'comments' && (
                    <CommentsTab comments={comments} onSendComment={onSendComment} /> // ใช้ comments ที่ Destructure แล้ว
                )}
                {activeTab === 'channels' && (
                    <ChannelsTab
                        restreamChannels={restreamChannels}
                        onFetchRestreamChannels={onFetchRestreamChannels}
                        onToggleChannelEnabled={onToggleRestreamChannel} // ส่งฟังก์ชัน onToggleRestreamChannel
                    />
                )}
                {activeTab === 'settings' && (
                    <SettingsTab
                        obsStatus={obsStatus}
                        runningText={runningText}
                        streamTitle={streamTitle}
                        onConnectOBS={onConnectOBS}
                        onDisconnectOBS={onDisconnectOBS}
                        onUpdateRunningText={onUpdateRunningText}
                        onUpdateStreamTitle={onUpdateStreamTitle}
                        onOpenPlatformSettings={onOpenPlatformSettings}
                        onSetModal={onSetModal}
                        onFetchRestreamChannels={onFetchRestreamChannels} // ส่งให้ SettingsTab ด้วย ถ้ามีการเรียกใช้
                    />
                )}
            </div>
        </div>
    );
};

export default RightPanel;