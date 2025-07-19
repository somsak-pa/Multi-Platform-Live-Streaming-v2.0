// src/components/ChannelsTab.tsx
import React from 'react';
import { RestreamChannel } from '../types';
import {
    FaFacebookF, FaYoutube, FaTiktok, FaInstagram, FaShopware,
    FaTwitch, FaXTwitter, FaGlobe, FaPlus, FaPencil, FaEye
} from 'react-icons/fa6';

// Helper Function for Platform Icons (ย้ายมาไว้ในไฟล์นี้)
const getPlatformIcon = (platformName: string) => {
    switch (platformName.toLowerCase()) {
        case 'facebook': return <FaFacebookF className="text-blue-500" />;
        case 'youtube': return <FaYoutube className="text-red-500" />;
        case 'twitch': return <FaTwitch className="text-purple-500" />;
        case 'x (twitter)': // ต้องให้ตรงกับค่าที่ Back-End ส่งมา
        case 'x':
        case 'twitter': return <FaXTwitter className="text-black dark:text-white" />;
        case 'instagram': return <FaInstagram className="text-pink-500" />;
        case 'shopee': return <FaShopware className="text-orange-500" />;
        case 'tiktok': return <FaTiktok className="text-black dark:text-white" />;
        default: return <FaGlobe className="text-gray-500" />;
    }
};


const ChannelsTab: React.FC<{
    restreamChannels: RestreamChannel[];
    onFetchRestreamChannels: () => void;
    onToggleChannelEnabled: (channelId: number, currentEnabledState: boolean) => void; // เพิ่ม prop นี้
}> = ({ restreamChannels, onFetchRestreamChannels, onToggleChannelEnabled }) => {
    // console.log('ChannelsTab received restreamChannels:', restreamChannels); // ลด log
    const activeChannelsCount = restreamChannels.filter(channel => channel.enabled).length; // ใช้ channel.enabled แทน channel.status === 'online'

    // handleToggleChannel จะเรียก onToggleChannelEnabled จาก App.tsx
    // ไม่ต้องมี API call ที่นี่แล้ว
    const handleToggleChannelClick = (channelId: number, currentEnabledState: boolean) => {
        onToggleChannelEnabled(channelId, currentEnabledState);
    };

    const handleToggleAllChannels = (turnOn: boolean) => {
        console.log(`Toggle all channels ${turnOn ? 'ON' : 'OFF'}. (API integration for this is more complex, usually handle one by one or via a specific "toggle all" API if Restream provides it)`);
        // Loop through all channels and call onToggleChannelEnabled for each
        // Note: This can cause many API calls. For a real app, a dedicated "toggle all" API is better.
        restreamChannels.forEach(channel => {
            if (channel.enabled !== turnOn) {
                onToggleChannelEnabled(channel.id, channel.enabled);
            }
        });
    };

    return (
        <div className="h-full flex flex-col p-4">
            {/* --- Header ส่วนบน (เหมือน Restream Dashboard) --- */}
            <div className="flex justify-between items-center mb-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center text-sm">
                    <FaPlus className="mr-2" /> Add Channel
                </button>
                <button className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center text-sm ml-2">
                    <FaPencil className="mr-2" /> Update Titles
                </button>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-4 pb-2 border-b dark:border-gray-700">
                <span>{activeChannelsCount} of {restreamChannels.length} active</span>
                <div className="flex items-center space-x-2">
                    <span>Toggle all</span>
                    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input
                            type="checkbox"
                            name="toggleAll"
                            id="toggleAll"
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            checked={activeChannelsCount === restreamChannels.length && restreamChannels.length > 0}
                            onChange={(e) => handleToggleAllChannels(e.target.checked)}
                        />
                        <label htmlFor="toggleAll" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                    </div>
                </div>
            </div>
            {/* -------------------------------------------------- */}

            {/* --- ส่วนแสดง Channel Cards --- */}
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {restreamChannels.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                        ไม่พบข้อมูลช่อง หรือยังไม่ได้เชื่อมต่อ Restream API.
                        <button onClick={onFetchRestreamChannels} className="text-blue-500 hover:underline mt-2 block mx-auto">ลองรีเฟรชข้อมูล</button>
                    </div>
                ) : (
                    restreamChannels.map(channel => (
                        <div key={channel.id} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-between shadow-sm">
                            <div className="flex items-center flex-grow">
                                {/* Platform Icon หรือ Profile Pic */}
                                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-2xl mr-3">
                                    {getPlatformIcon(channel.platform)}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">{channel.name}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {channel.platform}
                                    </div>
                                    <div className={`text-xs font-medium ${channel.enabled ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {channel.enabled ? 'ออนไลน์' : 'ออฟไลน์'} {/* ใช้ channel.enabled */}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                {/* Edit Button */}
                                <button className="text-blue-500 hover:text-blue-700 text-sm">Edit</button>

                                {/* Toggle Switch สำหรับแต่ละ Channel */}
                                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                    <input
                                        type="checkbox"
                                        name={`toggle-${channel.id}`}
                                        id={`toggle-${channel.id}`}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                        checked={channel.enabled} // ใช้ channel.enabled
                                        onChange={() => handleToggleChannelClick(channel.id, channel.enabled)} // ส่ง channel.enabled
                                    />
                                    <label htmlFor={`toggle-${channel.id}`} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                                </div>

                                {/* View Icon */}
                                <button className="text-gray-500 hover:text-gray-700 text-sm"><FaEye className="text-base" /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                    onClick={onFetchRestreamChannels}
                    className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center"
                >
                    <FaGlobe className="mr-2" /> รีเฟรชช่องสตรีม
                </button>
            </div>
        </div>
    );
};

export default ChannelsTab;