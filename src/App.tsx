import React, { useState, useEffect, useRef, useCallback, FC, useReducer } from 'react';
import StreamDetailsModal from './components/StreamDetailsModal';
import useLocalStorage from './hooks/useLocalStorage';
import { ObsManagementPanel } from './components/ObsManagementPanel';
import {
    FaFacebookF, FaYoutube, FaTiktok, FaInstagram, FaBoxOpen, FaPlus, FaEye,
    FaPlay, FaStop, FaComments, FaGear, FaPaperPlane, FaPencil,
    FaTrash, FaSun, FaMoon, FaChevronDown, FaKey, FaSatelliteDish, FaCircleCheck, FaCircleXmark,
    FaCircleInfo, FaCircleQuestion, FaEyeSlash, FaMicrophone,
    FaGlobe, FaUsers, FaTwitch
} from 'react-icons/fa6';
import OBSWebSocket from 'obs-websocket-js';
import { SiShopee } from 'react-icons/si';

// ✅ เพิ่มบรรทัดนี้: import { invoke } จาก @tauri-apps/api/core
import { invoke } from '@tauri-apps/api/core';
import {
    Product, Comment, OBSScene, OBSSource, OBSAudioInput, AppState, Action, RestreamChannel
} from './types';

// Environment Variables
const BACKEND_API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL;

// State Management with useReducer
const initialState: AppState = {
    obsStatus: 'disconnected',
    isStreaming: false,
    streamTime: '00:00:00',
    viewerCount: 0,
    products: [],
    selectedProductId: null,
    comments: [],
    analytics: { totalViewers: 0, peakViewers: 0, totalComments: 0 },
    runningText: '🔥 โปรโมชั่นพิเศษ! ',
    streamTitle: '',
    activeRightTab: 'comments',
    overlayProduct: null,
    scenes: [],
    currentSceneName: null,
    sources: [],
    audioInputs: [],
    restreamChannels: [],
};

function appReducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case 'SET_STATE':
            return { ...state, ...action.payload };
        case 'SET_OBS_STATUS':
            return { ...state, obsStatus: action.payload };
        case 'SET_STREAM_STATE':
            return { ...state, isStreaming: action.payload };
        case 'UPDATE_TIMER':
            return { ...state, streamTime: action.payload };
        case 'RESET_OBS_DATA':
            return { ...state, scenes: [], currentSceneName: null, sources: [], audioInputs: [] };
        case 'SET_OBS_DATA':
            const audioInputsWithLevels = action.payload.audioInputs.map(input => ({
                ...input,
                inputLevels: state.audioInputs.find(a => a.inputName === input.inputName)?.inputLevels || []
            }));
            return {
                ...state,
                scenes: action.payload.scenes,
                currentSceneName: action.payload.currentSceneName,
                sources: action.payload.sources,
                audioInputs: audioInputsWithLevels
            };
        case 'UPDATE_SOURCE_VISIBILITY':
            return {
                ...state,
                sources: state.sources.map(s =>
                    s.sceneItemId === action.payload.sceneItemId
                    ? { ...s, sceneItemEnabled: action.payload.sceneItemEnabled }
                    : s
                )
            };
        case 'UPDATE_MUTE_STATE':
            return {
                ...state,
                audioInputs: state.audioInputs.map(a =>
                    a.inputName === action.payload.inputName
                    ? { ...a, inputMuted: action.payload.inputMuted }
                    : a
                )
            };
        case 'SET_CURRENT_SCENE':
            return { ...state, currentSceneName: action.payload };
        case 'UPDATE_AUDIO_LEVELS':
            return {
                ...state,
                audioInputs: state.audioInputs.map(a =>
                    a.inputName === action.payload.inputName
                    ? { ...a, inputLevels: action.payload.levels }
                    : a
                )
            };
        case 'SET_RESTREAM_CHANNELS':
            return { ...state, restreamChannels: action.payload };
        case 'UPDATE_RESTREAM_CHANNEL_STATUS':
            return {
                ...state,
                restreamChannels: state.restreamChannels.map(channel =>
                    channel.id === action.payload.channelId
                    ? { ...channel, enabled: action.payload.enabled, status: action.payload.enabled ? 'online' : 'offline' }
                    : channel
                ),
            };
        default:
            return state;
    }
}

// Main App Component
const App: FC = () => {

    const obs = useRef(new OBSWebSocket());
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamTimerRef = useRef<number | null>(null);
    const productOverlayTimerRef = useRef<number | null>(null);

    const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('theme-dark', false);
    const [appState, dispatch] = useReducer(appReducer, initialState);
    const [modal, setModal] = useState<{ type: 'alert' | 'confirm' | 'product' | 'settings' | 'streamDetails' | null; props?: any }>({ type: null });
    const [sceneModal, setSceneModal] = useState<{ type: 'add' | null; props?: any }>({ type: null });
    const [streamDetailsModal, setStreamDetailsModal] = useState<{ isOpen: boolean; currentTitle: string; currentDescription: string; primaryChannelId: string | null } | null>(null);
    const [restreamAccessToken, setRestreamAccessToken] = useState<string | null>(localStorage.getItem('restream-access-token'));
    const [restreamRefreshToken, setRestreamRefreshToken] = useState<string | null>(localStorage.getItem('restream-refresh-token'));
    const [chatToken, setChatToken] = useState<string | null>(null);

    // --- Timer Controls ---
    const startStreamTimer = useCallback(() => {
        if (streamTimerRef.current) clearInterval(streamTimerRef.current);
        const startTime = Date.now();
        streamTimerRef.current = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            dispatch({ type: 'UPDATE_TIMER', payload: `${h}:${m}:${s}` });
        }, 1000);
    }, [dispatch]);

    const stopStreamTimer = useCallback(() => {
        if (streamTimerRef.current) clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        dispatch({ type: 'UPDATE_TIMER', payload: '00:00:00' });
    }, [dispatch]);

    const refreshAccessToken = useCallback(async (currentRefreshToken: string) => {
    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/auth/restream/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error refreshing token:', response.status, errorData);
            if (response.status === 400 || response.status === 401) {
                setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                localStorage.removeItem('restream-access-token');
                localStorage.removeItem('restream-refresh-token');
                setRestreamAccessToken(null);
                setRestreamRefreshToken(null);
            }
            throw new Error(`Failed to refresh token: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('Successfully refreshed tokens:', data);
        localStorage.setItem('restream-access-token', data.access_token);
        if (data.refresh_token) {
            localStorage.setItem('restream-refresh-token', data.refresh_token);
            setRestreamRefreshToken(data.refresh_token);
        }
        setRestreamAccessToken(data.access_token);
        return data.access_token;
    } catch (error) {
        console.error('Failed to refresh access token:', error);
        setModal({ type: 'alert', props: { message: 'ไม่สามารถ Refresh Token ได้ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
        localStorage.removeItem('restream-access-token');
        localStorage.removeItem('restream-refresh-token');
        setRestreamAccessToken(null);
        setRestreamRefreshToken(null);
        return null;
    }
}, [BACKEND_API_BASE_URL, setRestreamAccessToken, setRestreamRefreshToken, setModal]);

const fetchRestreamChannels = useCallback(async (accessToken?: string | null) => {
    const tokenToUse = accessToken || restreamAccessToken;

    if (!tokenToUse) {
        console.log('No Restream Access Token available. Clearing channels and skipping fetch/interval.');
        dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: [] });
        return;
    }

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/restream-channels`, {
            headers: {
                'Authorization': `Bearer ${tokenToUse}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Back-End API response not OK:", response.status, errorData);

            if (response.status === 401 || response.status === 403) {
                const currentRefreshToken = localStorage.getItem('restream-refresh-token');
                if (currentRefreshToken) {
                    console.log("Access token expired, attempting to refresh token...");
                    const newAccessToken = await refreshAccessToken(currentRefreshToken);
                    if (newAccessToken) {
                        console.log("Retrying fetchRestreamChannels with new token.");
                        return await fetchRestreamChannels(newAccessToken);
                    }
                }
                setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                localStorage.removeItem('restream-access-token');
                localStorage.removeItem('restream-refresh-token');
                setRestreamAccessToken(null);
                setRestreamRefreshToken(null);
            }
            throw new Error(`HTTP error! status: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: data });
        } else if (data && Array.isArray(data.channels)) {
            console.warn("Restream API data is an object with 'channels' key. Using data.channels.");
            dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: data.channels });
        } else {
            console.error("Unexpected data format from Back-End:", data);
            dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: [] });
        }

    } catch (error) {
        console.error("Failed to fetch Restream channels:", error);
        let errorMessage = 'ไม่ทราบข้อผิดพลาด';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = String(error);
        }
        if (error instanceof Error && error.message.includes('401')) {
        } else {
            setModal({ type: 'alert', props: { message: `ไม่สามารถดึงข้อมูลช่อง Restream ได้: ${errorMessage}`, alertType: 'error' } });
        }
    }
}, [dispatch, setRestreamAccessToken, setRestreamRefreshToken, setModal, restreamAccessToken, BACKEND_API_BASE_URL, refreshAccessToken]);

const handleToggleRestreamChannel = useCallback(async (channelId: number, currentEnabledState: boolean) => {
    const tokenToUse = restreamAccessToken || localStorage.getItem('restream-access-token');
    if (!tokenToUse) {
        setModal({ type: 'alert', props: { message: 'ไม่มี Token สำหรับ Restream.io กรุณาเชื่อมต่อบัญชีใหม่', alertType: 'info' } });
        return;
    }

    const newEnabledState = !currentEnabledState;

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/restream-channels/${channelId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenToUse}`
            },
            body: JSON.stringify({ enabled: newEnabledState })
        });

        if (!response.ok) {
            const errorData = await response.json();

            if (response.status === 401 || response.status === 403) {
                const currentRefreshToken = localStorage.getItem('restream-refresh-token');
                if (currentRefreshToken) {
                    console.log("Access token expired for toggle, attempting to refresh token...");
                    const newAccessToken = await refreshAccessToken(currentRefreshToken);
                    if (newAccessToken) {
                        console.log("Retrying handleToggleRestreamChannel with new token.");
                        return await handleToggleRestreamChannel(channelId, currentEnabledState);
                    }
                }
                setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                localStorage.removeItem('restream-access-token');
                localStorage.removeItem('restream-refresh-token');
                setRestreamAccessToken(null);
                setRestreamRefreshToken(null);
            }
            throw new Error(`Failed to update channel status: ${errorData.message || response.statusText}`);
        }

        const updatedChannelData = await response.json();
        dispatch({
            type: 'UPDATE_RESTREAM_CHANNEL_STATUS',
            payload: { channelId: channelId, enabled: updatedChannelData.active }
        });

        const nameToDisplay = appState.restreamChannels.find(c => c.id === channelId)?.name || 'ช่อง';

        setModal({ type: 'alert', props: { message: `อัปเดตสถานะช่อง ${nameToDisplay} เป็น ${newEnabledState ? 'เปิด' : 'ปิด'} สำเร็จ!`, alertType: 'success' } });

        fetchRestreamChannels();

    } catch (error) {
        console.error('Error toggling Restream channel status:', error);
        let errorMessage = 'ไม่ทราบข้อผิดพลาด';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = String(error);
        }
        setModal({ type: 'alert', props: { message: `ไม่สามารถอัปเดตสถานะช่องได้: ${errorMessage}`, alertType: 'error' } });
    }
}, [restreamAccessToken, fetchRestreamChannels, setModal, setRestreamAccessToken, setRestreamRefreshToken, dispatch, BACKEND_API_BASE_URL, refreshAccessToken, appState.restreamChannels]);

const handleOpenStreamDetails = useCallback(() => {
    console.log("handleOpenStreamDetails ถูกเรียกแล้ว!");
    const currentTitle = appState.streamTitle;
    const currentDescription = "Restream helps you multistream & reach your audience, wherever they are.";

    const primaryChannel = appState.restreamChannels.find(c => c.isPrimary || c.platform === 'YouTube');
    const primaryChannelId = primaryChannel ? String(primaryChannel.id) : null;
    console.log("currentTitle ก่อนตั้งค่า Modal:", currentTitle);
    console.log("currentDescription ก่อนตั้งค่า Modal:", currentDescription);
    console.log("primaryChannelId ก่อนตั้งค่า Modal:", primaryChannelId);
    if (!primaryChannelId) {
        setModal({ type: 'alert', props: { message: 'ไม่พบช่องหลักสำหรับอัปเดตรายละเอียดสตรีม', alertType: 'error' } });
        return;
    }

    setStreamDetailsModal({
        isOpen: true,
        currentTitle: currentTitle,
        currentDescription: currentDescription,
        primaryChannelId: primaryChannelId
    });
}, [appState.streamTitle, appState.restreamChannels, setModal]);

const handleUpdateStreamDetails = useCallback(async (channelId: string, title: string, description: string) => {
    const tokenToUse = restreamAccessToken || localStorage.getItem('restream-access-token');
    if (!tokenToUse) {
        setModal({ type: 'alert', props: { message: 'กรุณาเชื่อมต่อ Restream เพื่ออัปเดตรายละเอียดสตรีม', alertType: 'info' } });
        return false;
    }

    if (!channelId) {
        setModal({ type: 'alert', props: { message: 'ไม่พบ Channel ID สำหรับอัปเดตรายละเอียดสตรีม', alertType: 'error' } });
        return false;
    }

    try {
        const payload = {
            title: title,
            description: description
        };

        const response = await fetch(`${BACKEND_API_BASE_URL}/api/restream-channel-meta/${channelId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenToUse}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error updating stream details in Backend:', response.status, errorData);

            if (response.status === 401 || response.status === 403) {
                const currentRefreshToken = localStorage.getItem('restream-refresh-token');
                if (currentRefreshToken) {
                    console.log("Access token expired, attempting to refresh token for stream details update...");
                    const newAccessToken = await refreshAccessToken(currentRefreshToken);
                    if (newAccessToken) {
                        console.log("Retrying handleUpdateStreamDetails with new token.");
                        return await handleUpdateStreamDetails(channelId, title, description);
                    }
                }
                setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                localStorage.removeItem('restream-access-token');
                localStorage.removeItem('restream-refresh-token');
                setRestreamAccessToken(null);
                setRestreamRefreshToken(null);
            }
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
        }

        const updatedRestreamDetails = await response.json();
        console.log("Successfully updated stream details:", updatedRestreamDetails);

        setModal({ type: 'alert', props: { message: 'อัปเดตรายละเอียดสตรีมสำเร็จ!', alertType: 'success' } });

        fetchRestreamChannels();

        return true;
    } catch (error) {
        console.error('Failed to update stream details:', error);
        let errorMessage = 'ไม่ทราบข้อผิดพลาด';
        if (error instanceof Error) errorMessage = error.message;
        else if (typeof error === 'string') errorMessage = error;
        else errorMessage = String(error);
        setModal({ type: 'alert', props: { message: `ไม่สามารถอัปเดตรายละเอียดสตรีมได้: ${errorMessage}`, alertType: 'error' } });
        return false;
    }
}, [BACKEND_API_BASE_URL, restreamAccessToken, refreshAccessToken, setModal, setRestreamAccessToken, setRestreamRefreshToken, fetchRestreamChannels]);

const fetchChatToken = useCallback(async (accessToken: string) => {
    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/chat-token`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.webChatUrl) {
            setChatToken(data.webChatUrl);
        } else {
            console.error("webChatUrl not found in backend response for chat-token:", data);
            setChatToken(null);
        }

    } catch (error) {
        console.error("Failed to fetch chat token (webChatUrl):", error);
        setChatToken(null);
    }
}, [BACKEND_API_BASE_URL, setChatToken]);


    // --- Theme Effect ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // --- Product Loading Effect ---
    useEffect(() => {
        const savedProducts = localStorage.getItem('products');
        const initialProducts = savedProducts ? JSON.parse(savedProducts) : [{ id: 1, name: 'เสื้อยืดพรีเมียม', price: 350, category: 'featured', icon: '👕' }];
        dispatch({ type: 'SET_STATE', payload: { products: initialProducts } });
    }, []);

    // --- Camera Setup Effect ---
    useEffect(() => {
        const setupCamera = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const obsVirtualCamera = devices.find(device =>
                    device.kind === 'videoinput' &&
                    (device.label.includes('OBS Virtual Camera') || device.label.includes('OBS VirtualCam'))
                );

                let stream: MediaStream;

                if (obsVirtualCamera) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: { exact: obsVirtualCamera.deviceId },
                            aspectRatio: 16 / 9,
                        },
                        audio: true
                    });
                } else {
                    console.warn("OBS Virtual Camera not found. Using default camera.");
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { aspectRatio: 16 / 9 },
                        audio: true
                    });
                    setModal({ type: 'alert', props: { message: 'ไม่พบ OBS Virtual Camera. กำลังใช้กล้องเริ่มต้นของเครื่อง', alertType: 'info' } });
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error("Camera Error:", error);
                setModal({ type: 'alert', props: { message: 'ไม่สามารถเข้าถึงกล้องได้ ตรวจสอบว่ากล้องไม่ได้ถูกใช้งานโดยโปรแกรมอื่น', alertType: 'error' } });
            }
        };
        setupCamera();
    }, []);

    // --- Fetch OBS Data ---
    const fetchOBSData = useCallback(async () => {
        if (!obs.current.identified) {
            return;
        }
        try {
            const [sceneListData, currentSceneData, allInputListData] = await Promise.all([
                obs.current.call('GetSceneList'),
                obs.current.call('GetCurrentProgramScene'),
                obs.current.call('GetInputList'),
            ]);

            const currentSceneName = currentSceneData.currentProgramSceneName;
            if (!currentSceneName) {
                console.warn('[DEBUG] No current program scene found. Exiting fetchOBSData.');
                return;
            }

            const sourceListData = await obs.current.call('GetSceneItemList', { sceneName: currentSceneName });
            const sources: OBSSource[] = sourceListData.sceneItems.map((item: any) => ({
                sceneItemId: Number(item.sceneItemId),
                sourceName: String(item.sourceName),
                sceneItemEnabled: Boolean(item.sceneItemEnabled)
            }));

            const audioInputsRaw: Omit<OBSAudioInput, 'inputLevels'>[] = await Promise.all(
                allInputListData.inputs
                .filter((input: any) =>
                    input.inputKind.includes('wasapi') ||
                    input.inputKind.includes('coreaudio') ||
                    input.inputKind.includes('pulse') ||
                    input.inputKind.includes('mic')
                )
                .map(async (input: any) => {
                    try {
                        const { inputMuted } = await obs.current.call('GetInputMute', { inputName: input.inputName });
                        const { inputVolumeDb } = await obs.current.call('GetInputVolume', { inputName: input.inputName });

                        return {
                            inputName: String(input.inputName),
                            inputMuted: Boolean(inputMuted),
                            inputVolumeDb: Number(inputVolumeDb) || -100,
                        };
                    } catch (e) {
                        console.error(`Error fetching data for audio input ${input.inputName}:`, e);
                        return {
                            inputName: String(input.inputName),
                            inputMuted: false,
                            inputVolumeDb: -100,
                        };
                    }
                })
            );
            const scenes: OBSScene[] = sceneListData.scenes.map((scene: any) => ({
                sceneName: String(scene.sceneName)
            }));

            dispatch({
                type: 'SET_OBS_DATA',
                payload: {
                    scenes: scenes,
                    currentSceneName: currentSceneName,
                    sources: sources,
                    audioInputs: audioInputsRaw
                }
            });

        } catch (e) {
            console.error("[DEBUG] Error inside fetchOBSData:", e);
            if (e && (e as any).code === 'NOT_IDENTIFIED') {
                setModal({ type: 'alert', props: { message: 'การเชื่อมต่อ OBS ไม่ได้ถูกยืนยัน (Authentication Failed หรือ Timing Issue)', alertType: 'error' } });
            } else {
                setModal({ type: 'alert', props: { message: 'ไม่สามารถดึงข้อมูล OBS ได้ หรือเกิดข้อผิดพลาดในการประมวลผลข้อมูล', alertType: 'error' } });
            }
        }
    }, [dispatch, setModal]);

    // --- OBS Event Listeners Effect ---
    useEffect(() => {
        const obsInstance = obs.current;

        const onStreamStateChanged = (data: { outputActive: boolean; }) => {
            dispatch({ type: 'SET_STREAM_STATE', payload: data.outputActive });
            if (data.outputActive) startStreamTimer();
            else stopStreamTimer();
        };

        const onConnectionOpened = () => {
            dispatch({ type: 'SET_OBS_STATUS', payload: 'connected' });
        };

        const onIdentified = async () => {
           //console.log('[DEBUG] OBS identified successfully!');
            dispatch({ type: 'SET_OBS_STATUS', payload: 'connected' });
            setModal({ type: 'alert', props: { message: 'เชื่อมต่อและยืนยันตัวตนกับ OBS สำเร็จ!', alertType: 'success' } });
            await fetchOBSData();

        };

        const onConnectionClosed = () => {
            dispatch({ type: 'SET_OBS_STATUS', payload: 'disconnected' });
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            dispatch({ type: 'RESET_OBS_DATA' });
            stopStreamTimer();
            setModal({ type: 'alert', props: { message: 'ตัดการเชื่อมต่อจาก OBS แล้ว', alertType: 'info' } });
        };

        const onCurrentProgramSceneChanged = () => {
            fetchOBSData();
        };
        const onSceneListChanged = () => {
            fetchOBSData();
        };
        const onInputCreated = () => {
            fetchOBSData();
        };
        const onInputRemoved = () => {
            fetchOBSData();
        };
        const onInputNameChanged = () => {
            fetchOBSData();
        };
        const onSceneItemEnableStateChanged = (data: { sceneItemId: number; sceneItemEnabled: boolean }) => {
            dispatch({ type: 'UPDATE_SOURCE_VISIBILITY', payload: data });
        };
        const onInputMuteStateChanged = (data: { inputName: string; inputMuted: boolean }) => {
            dispatch({ type: 'UPDATE_MUTE_STATE', payload: data });
        };
        const onInputVolumeMeters = (data: any) => {
            if (data && Array.isArray(data.inputs)) {
                for (const input of data.inputs) {
                    if (input.inputName && input.inputLevels) {
                        dispatch({
                            type: 'UPDATE_AUDIO_LEVELS',
                            payload: {
                                inputName: input.inputName,
                                levels: input.inputLevels,
                            },
                        });
                    }
                }
            }
        };

        obsInstance.on('StreamStateChanged', onStreamStateChanged);
        obsInstance.on('ConnectionOpened', onConnectionOpened);
        obsInstance.on('Identified', onIdentified);
        obsInstance.on('ConnectionClosed', onConnectionClosed);
        obsInstance.on('CurrentProgramSceneChanged', onCurrentProgramSceneChanged);
        obsInstance.on('SceneListChanged', onSceneListChanged);
        obsInstance.on('InputCreated', onInputCreated);
        obsInstance.on('InputRemoved', onInputRemoved);
        obsInstance.on('InputNameChanged', onInputNameChanged);
        obsInstance.on('SceneItemEnableStateChanged', onSceneItemEnableStateChanged);
        obsInstance.on('InputMuteStateChanged', onInputMuteStateChanged);
        obsInstance.on('InputVolumeMeters', onInputVolumeMeters);

        return () => {
            obsInstance.off('StreamStateChanged', onStreamStateChanged);
            obsInstance.off('ConnectionOpened', onConnectionOpened);
            obsInstance.off('Identified', onIdentified);
            obsInstance.off('ConnectionClosed', onConnectionClosed);
            obsInstance.off('CurrentProgramSceneChanged', onCurrentProgramSceneChanged);
            obsInstance.off('SceneListChanged', onSceneListChanged);
            obsInstance.off('InputCreated', onInputCreated);
            obsInstance.off('InputRemoved', onInputRemoved);
            obsInstance.off('InputNameChanged', onInputNameChanged);
            obsInstance.off('SceneItemEnableStateChanged', onSceneItemEnableStateChanged);
            obsInstance.off('InputMuteStateChanged', onInputMuteStateChanged);
            obsInstance.off('InputVolumeMeters', onInputVolumeMeters);
            if(obsInstance.identified) obsInstance.disconnect();
        };
    }, [fetchOBSData, dispatch, setModal, startStreamTimer, stopStreamTimer, appState.restreamChannels]);

    // --- Restream OAuth Callback Effect ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth_status');
        const message = urlParams.get('message');
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');

        if (authStatus) {
            if (authStatus === 'success' && accessToken) {
                setRestreamAccessToken(accessToken);
                if (refreshToken) {
                    localStorage.setItem('restream-refresh-token', refreshToken);
                    setRestreamRefreshToken(refreshToken);
                }
                fetchChatToken(accessToken);
                fetchRestreamChannels(accessToken);
                setModal({ type: 'alert', props: { message: 'เชื่อมต่อ Restream สำเร็จแล้ว!', alertType: 'success' } });

                window.history.replaceState({}, document.title, window.location.pathname);

            } else if (authStatus === 'failed') {
                setModal({ type: 'alert', props: { message: `เชื่อมต่อ Restream ล้มเหลว: ${decodeURIComponent(message || 'ไม่ทราบสาเหตุ')}`, alertType: 'error' } });
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [setRestreamAccessToken, setModal, fetchChatToken, fetchRestreamChannels, setRestreamRefreshToken]);


    // --- Restream Channels Polling Effect ---
    useEffect(() => {
        let intervalId: number | undefined;

        const initiateFetchAndInterval = async () => {
            if (!restreamAccessToken) {
                dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: [] });
                return;
            }

            await fetchRestreamChannels();

            intervalId = window.setInterval(fetchRestreamChannels, 30000); // Poll every 30 seconds for channels status

        };

        initiateFetchAndInterval();

        return () => {
            if (intervalId) {
                window.clearInterval(intervalId);
            }
        };
    }, [restreamAccessToken, fetchRestreamChannels, dispatch]);

    // --- Persist Restream Access Token to Local Storage ---
    useEffect(() => {
        if (restreamAccessToken) {
            localStorage.setItem('restream-access-token', restreamAccessToken);
            if (restreamRefreshToken) {
                localStorage.setItem('restream-refresh-token', restreamRefreshToken);
            }
        } else {
            localStorage.removeItem('restream-access-token');
            localStorage.removeItem('restream-refresh-token');
        }
    }, [restreamAccessToken, restreamRefreshToken]);


    // --- OBS Handlers ---
    const handleConnectOBS = useCallback(async (ip: string, port: string, password: string, savePassword: boolean) => {
        dispatch({ type: 'SET_OBS_STATUS', payload: 'connecting' });
        try {
            await obs.current.connect(`ws://${ip}:${port}`, password, {
                eventSubscriptions:
                    (1 << 0) | // General (e.g., Identified, ExitStarted)
                    (1 << 1) | // Config (e.g., CurrentProfileChanged)
                    (1 << 2) | // Scenes (CurrentProgramSceneChanged, SceneListChanged)
                    (1 << 3) | // Inputs (InputCreated, InputRemoved, InputMuteStateChanged)
                    (1 << 5) | // Inputs (InputMuteStateChanged, InputVolumeMeters)
                    (1 << 6) | // Transitions
                    (1 << 7) | // Filters
                    (1 << 8) | // Outputs (StreamStateChanged)
                    (1 << 10)| // SceneItems (SceneItemEnableStateChanged)
                    (1 << 9)   // InputVolumeMeters (High-Volume)
            });
            localStorage.setItem('obs-ip', ip);
            localStorage.setItem('obs-port', port);
            localStorage.setItem('obs-save-password', String(savePassword));
            if (savePassword) localStorage.setItem('obs-password', password);
            else localStorage.removeItem('obs-password');
        } catch (error: any) {
            dispatch({ type: 'SET_OBS_STATUS', payload: 'failed' });
            const message = error.code === 'AUTHENTICATION_FAILED' ? 'รหัสผ่านไม่ถูกต้อง' : 'เชื่อมต่อล้มเหลว';
            setModal({ type: 'alert', props: { message, alertType: 'error' } });
        }
    }, [dispatch, setModal]);

    const handleSetCurrentScene = useCallback(async (sceneName: string) => {
        dispatch({ type: 'SET_CURRENT_SCENE', payload: sceneName });
        try {
            await obs.current.call('SetCurrentProgramScene', { sceneName });
        } catch (e) {
            console.error('Failed to set scene', e);
            setModal({ type: 'alert', props: { message: 'ไม่สามารถเปลี่ยนซีนได้', alertType: 'error' } });
        }
    }, [dispatch, setModal]);

    const handleToggleSourceVisibility = useCallback(async (sceneName: string | null, sceneItemId: number, isVisible: boolean) => {
        if (!sceneName) return;
        try {
            await obs.current.call('SetSceneItemEnabled', { sceneName, sceneItemEnabled: !isVisible, sceneItemId });
        } catch (e) {
            console.error('Failed to toggle source visibility', e);
            setModal({ type: 'alert', props: { message: 'ไม่สามารถสลับการแสดงผล Source ได้', alertType: 'error' } });
        }
    }, [setModal]);

    const handleToggleMute = useCallback(async (inputName: string, isMuted: boolean) => {
        try {
            await obs.current.call('SetInputMute', { inputName, inputMuted: !isMuted });
        } catch (e) {
            console.error('Failed to toggle mute', e);
            setModal({ type: 'alert', props: { message: 'ไม่สามารถสลับการ Mute ได้', alertType: 'error' } });
        }
    }, [setModal]);

    const handleDisconnectOBS = useCallback(async () => {
        try {
            await obs.current.disconnect();
        } catch (e) {
            console.error('Error disconnecting OBS:', e);
        }
    }, []);

const startSpecificMultiOutput = useCallback(async (targetName: string) => {
    console.log(`🚀 Starting ${targetName} stream via RTMP Server...`);
    
    if (appState.obsStatus !== 'connected') {
        setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
        return;
    }
    
    if (appState.isStreaming) {
        setModal({ type: 'alert', props: { message: 'กำลังสตรีมอยู่แล้ว', alertType: 'info' } });
        return;
    }

    if (!obs.current.identified) {
        setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อหรือยืนยันตัวตนกับ OBS โปรดเชื่อมต่อก่อน', alertType: 'error' } });
        return;
    }

    try {
        // 🔧 ตั้งค่า OBS Stream Service ให้ส่งไป RTMP Server อัตโนมัติ
        console.log(`Setting up OBS Stream Service for ${targetName} via RTMP Server...`);
        await obs.current.call('SetStreamServiceSettings', {
            streamServiceType: 'rtmp_custom',
            streamServiceSettings: {
                server: 'rtmp://127.0.0.1:1935/live',
                key: 'my-stream-key'
            }
        });
        
        console.log(`OBS Stream Service configured for ${targetName}!`);
        
        // เริ่ม stream timer
        startStreamTimer();
        dispatch({ type: 'SET_STREAM_STATE', payload: true });
        
        // สั่งให้ OBS เริ่มสตรีม
        console.log(`Attempting to start OBS stream for ${targetName}...`);
        await obs.current.call('StartStream');
        
        // รอจนกว่า OBS จะเริ่มสตรีมจริงๆ
        let isStreamActive = false;
        let attemptCount = 0;
        const maxAttempts = 10;
        const checkInterval = 1000;

        while (!isStreamActive && attemptCount < maxAttempts) {
            console.log(`Checking ${targetName} stream status... (Attempt ${attemptCount + 1}/${maxAttempts})`);
            const status = await obs.current.call('GetStreamStatus');
            isStreamActive = status.outputActive;
            if (!isStreamActive) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            attemptCount++;
        }

        if (!isStreamActive) {
            console.error(`${targetName} stream did not start after multiple attempts.`);
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            setModal({ type: 'alert', props: { message: `ไม่สามารถเริ่มสตรีม ${targetName} ได้ โปรดตรวจสอบการตั้งค่าและลองใหม่อีกครั้ง`, alertType: 'error' } });
            return;
        }

        console.log(`${targetName} stream started successfully. RTMP Server should now relay to YouTube!`);
        setModal({ type: 'alert', props: { message: `เริ่มสตรีม ${targetName} สำเร็จ! กำลังส่งไป YouTube ผ่าน RTMP Server`, alertType: 'success' } });

    } catch (error: any) {
        console.error(`❌ Failed to start ${targetName} stream:`, error);
        dispatch({ type: 'SET_STREAM_STATE', payload: false });
        stopStreamTimer();
        
        let errorMessage = error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
        if (error.code === 'NOT_CONFIGURED') {
            errorMessage = 'ยังไม่ได้ตั้งค่า Stream Service ใน OBS. กรุณาตั้งค่า Server/Key ก่อน';
        }
        setModal({ type: 'alert', props: { message: `ไม่สามารถเริ่มสตรีม ${targetName} ได้: ${errorMessage}`, alertType: 'error' } });
    }
}, [appState.obsStatus, appState.isStreaming, obs, startStreamTimer, stopStreamTimer, dispatch, setModal]);

    const stopSpecificMultiOutput = useCallback(async (targetName: string) => {
        console.log(`🛑 Stop ${targetName} button clicked`);
        
        if (appState.obsStatus !== 'connected') {
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }

        // ตรวจสอบว่า OBS WebSocket พร้อมใช้งาน
        if (!obs.current || !obs.current.identified) {
            setModal({ type: 'alert', props: { message: 'OBS WebSocket ไม่พร้อม กรุณาเชื่อมต่อใหม่', alertType: 'error' } });
            return;
        }

        try {
            // แทนที่จะใช้ Multi-RTMP Plugin ให้ใช้ Stop Stream ปกติ
            console.log(`📱 Stopping main stream for ${targetName}...`);
            
            // ตรวจสอบสถานะ stream ปัจจุบัน
            let currentStatus;
            try {
                currentStatus = await obs.current.call('GetStreamStatus');
                console.log(`📊 Current stream status for ${targetName}:`, {
                    outputActive: currentStatus?.outputActive,
                    outputReconnecting: currentStatus?.outputReconnecting
                });
            } catch (statusError: any) {
                console.warn(`⚠️ Could not get stream status for ${targetName}:`, statusError.message);
            }

            // ถ้าไม่ได้สตรีมอยู่
            if (currentStatus && !currentStatus.outputActive) {
                console.log(`ℹ️ ${targetName} stream is already stopped`);
                dispatch({ type: 'SET_STREAM_STATE', payload: false });
                stopStreamTimer();
                setModal({ type: 'alert', props: { message: `${targetName} ไม่ได้สตรีมอยู่ในขณะนี้`, alertType: 'info' } });
                return;
            }

            // ส่งคำสั่งหยุด stream
            console.log(`🛑 Sending stop stream command for ${targetName}...`);
            await obs.current.call('StopStream');
            
            // รอและตรวจสอบว่าหยุดจริง
            let stopConfirmed = false;
            let attempts = 0;
            const maxAttempts = 8;
            
            while (!stopConfirmed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 400));
                
                try {
                    const verifyStatus = await obs.current.call('GetStreamStatus');
                    console.log(`🔍 ${targetName} verification attempt ${attempts + 1}:`, {
                        outputActive: verifyStatus?.outputActive
                    });
                    
                    if (!verifyStatus.outputActive) {
                        console.log(`✅ ${targetName} stream confirmed stopped`);
                        stopConfirmed = true;
                        break;
                    }
                } catch (verifyError: any) {
                    console.log(`⚠️ ${targetName} verification attempt ${attempts + 1} failed:`, verifyError.message);
                    if (attempts >= 3) {
                        console.log(`🤷 Cannot verify ${targetName} status, assuming stopped`);
                        stopConfirmed = true;
                        break;
                    }
                }
                attempts++;
            }

            // อัปเดต UI state
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            if (stopConfirmed) {
                console.log(`🎉 ${targetName} stopped successfully`);
                setModal({ type: 'alert', props: { message: `หยุดสตรีม ${targetName} สำเร็จ!`, alertType: 'success' } });
            } else {
                console.log(`⚠️ ${targetName} stop command sent but could not verify`);
                setModal({ type: 'alert', props: { message: `ส่งคำสั่งหยุด ${targetName} แล้ว แต่ไม่สามารถยืนยันได้ กรุณาตรวจสอบ OBS`, alertType: 'warning' } });
            }

        } catch (error: any) {
            console.error(`❌ Error stopping ${targetName}:`, {
                message: error.message,
                code: error.code
            });
            
            // อัปเดต UI state เพื่อป้องกันการติดค้าง
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            let userMessage = `เกิดข้อผิดพลาดขณะหยุด ${targetName}`;
            let alertType: 'error' | 'warning' = 'error';
            
            if (error.code === 'NOT_STREAMING') {
                userMessage = `${targetName} ไม่ได้สตรีมอยู่ (อัปเดท UI แล้ว)`;
                alertType = 'warning';
            } else if (error.message?.includes('Connection') || error.message?.includes('WebSocket')) {
                userMessage = `การเชื่อมต่อ OBS หลุด แต่อัปเดท UI แล้ว (อาจหยุด ${targetName} แล้ว)`;
                alertType = 'warning';
            } else if (error.message?.includes('timeout')) {
                userMessage = `หมดเวลารอ OBS ตอบกลับ แต่อัปเดท UI แล้ว (${targetName})`;
                alertType = 'warning';
            } else {
                userMessage = `ข้อผิดพลาด ${targetName}: ${error.message || 'ไม่ทราบสาเหตุ'} (อัปเดท UI แล้ว)`;
                alertType = 'warning';
            }
            
            setModal({ type: 'alert', props: { message: userMessage, alertType } });
        }
    }, [appState.obsStatus, setModal, obs, dispatch, stopStreamTimer]);

    const startAllMultiOutputs = useCallback(async () => {
        console.log('🚀 Starting all outputs via RTMP Server...');
        
        if (appState.obsStatus !== 'connected') {
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }
        
        if (appState.isStreaming) {
            setModal({ type: 'alert', props: { message: 'กำลังสตรีมอยู่แล้ว', alertType: 'info' } });
            return;
        }

        if (!obs.current.identified) {
            setModal({ type: 'alert', props: { message: 'OBS WebSocket ไม่พร้อม กรุณาเชื่อมต่อใหม่', alertType: 'error' } });
            return;
        }

        try {
            // 🔧 ตั้งค่า OBS Stream Service ให้ส่งไป RTMP Server อัตโนมัติ
            console.log('Setting up OBS Stream Service for all outputs via RTMP Server...');
            await obs.current.call('SetStreamServiceSettings', {
                streamServiceType: 'rtmp_custom',
                streamServiceSettings: {
                    server: 'rtmp://127.0.0.1:1935/live',
                    key: 'my-stream-key'
                }
            });
            
            console.log('OBS Stream Service configured for all outputs!');
            
            // เริ่ม stream timer
            startStreamTimer();
            dispatch({ type: 'SET_STREAM_STATE', payload: true });
            
            // สั่งให้ OBS เริ่มสตรีม
            console.log('Attempting to start OBS stream for all outputs...');
            await obs.current.call('StartStream');
            
            // รอจนกว่า OBS จะเริ่มสตรีมจริงๆ
            let isStreamActive = false;
            let attemptCount = 0;
            const maxAttempts = 10;
            const checkInterval = 1000;

            while (!isStreamActive && attemptCount < maxAttempts) {
                console.log(`Checking all outputs stream status... (Attempt ${attemptCount + 1}/${maxAttempts})`);
                const status = await obs.current.call('GetStreamStatus');
                isStreamActive = status.outputActive;
                if (!isStreamActive) {
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                }
                attemptCount++;
            }

            if (!isStreamActive) {
                console.error('All outputs stream did not start after multiple attempts.');
                dispatch({ type: 'SET_STREAM_STATE', payload: false });
                stopStreamTimer();
                setModal({ type: 'alert', props: { message: 'ไม่สามารถเริ่มสตรีมทั้งหมดได้ โปรดตรวจสอบการตั้งค่าและลองใหม่อีกครั้ง', alertType: 'error' } });
                return;
            }

            console.log('All outputs stream started successfully. RTMP Server should now relay to YouTube!');
            setModal({ type: 'alert', props: { message: 'เริ่มสตรีมทั้งหมดสำเร็จ! กำลังส่งไป YouTube ผ่าน RTMP Server', alertType: 'success' } });

        } catch (error: any) {
            console.error('❌ Failed to start all outputs:', error);
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            let errorMessage = error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
            if (error.code === 'NOT_CONFIGURED') {
                errorMessage = 'ยังไม่ได้ตั้งค่า Stream Service ใน OBS. กรุณาตั้งค่า Server/Key ก่อน';
            }
            setModal({ type: 'alert', props: { message: `ไม่สามารถเริ่มสตรีมทั้งหมดได้: ${errorMessage}`, alertType: 'error' } });
        }
    }, [appState.obsStatus, appState.isStreaming, obs, startStreamTimer, stopStreamTimer, dispatch, setModal]);

    const stopAllMultiOutputs = useCallback(async () => {
        console.log('🛑 Stop All Multi-Outputs button clicked');
        
        if (appState.obsStatus !== 'connected') {
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }

        if (!obs.current || !obs.current.identified) {
            setModal({ type: 'alert', props: { message: 'OBS WebSocket ไม่พร้อม กรุณาเชื่อมต่อใหม่', alertType: 'error' } });
            return;
        }

        try {
            // แทนที่จะใช้ Multi-RTMP Plugin ให้ใช้ Stop Stream ปกติ
            console.log('📱 Stopping main stream for all outputs...');
            
            // ตรวจสอบสถานะ stream ปัจจุบัน
            let currentStatus;
            try {
                currentStatus = await obs.current.call('GetStreamStatus');
                console.log('📊 Current stream status for all outputs:', {
                    outputActive: currentStatus?.outputActive,
                    outputReconnecting: currentStatus?.outputReconnecting
                });
            } catch (statusError: any) {
                console.warn('⚠️ Could not get stream status for all outputs:', statusError.message);
            }

            // ถ้าไม่ได้สตรีมอยู่
            if (currentStatus && !currentStatus.outputActive) {
                console.log('ℹ️ All outputs are already stopped');
                dispatch({ type: 'SET_STREAM_STATE', payload: false });
                stopStreamTimer();
                setModal({ type: 'alert', props: { message: 'ไม่ได้สตรีมอยู่ในขณะนี้', alertType: 'info' } });
                return;
            }

            // ส่งคำสั่งหยุด stream
            console.log('🛑 Sending stop stream command for all outputs...');
            await obs.current.call('StopStream');
            
            // รอและตรวจสอบว่าหยุดจริง
            let stopConfirmed = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!stopConfirmed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 400));
                
                try {
                    const verifyStatus = await obs.current.call('GetStreamStatus');
                    console.log(`🔍 All outputs verification attempt ${attempts + 1}:`, {
                        outputActive: verifyStatus?.outputActive
                    });
                    
                    if (!verifyStatus.outputActive) {
                        console.log('✅ All outputs confirmed stopped');
                        stopConfirmed = true;
                        break;
                    }
                } catch (verifyError: any) {
                    console.log(`⚠️ All outputs verification attempt ${attempts + 1} failed:`, verifyError.message);
                    if (attempts >= 4) {
                        console.log('🤷 Cannot verify all outputs status, assuming stopped');
                        stopConfirmed = true;
                        break;
                    }
                }
                attempts++;
            }

            // อัปเดต UI state
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            if (stopConfirmed) {
                console.log('🎉 All outputs stopped successfully');
                setModal({ type: 'alert', props: { message: 'หยุดสตรีมทั้งหมดสำเร็จ!', alertType: 'success' } });
            } else {
                console.log('⚠️ Stop all outputs command sent but could not verify');
                setModal({ type: 'alert', props: { message: 'ส่งคำสั่งหยุดทั้งหมดแล้ว แต่ไม่สามารถยืนยันได้ กรุณาตรวจสอบ OBS', alertType: 'warning' } });
            }

        } catch (error: any) {
            console.error('❌ Error stopping all outputs:', {
                message: error.message,
                code: error.code
            });
            
            // อัปเดต UI state เพื่อป้องกันการติดค้าง
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            let userMessage = 'เกิดข้อผิดพลาดขณะหยุดสตรีมทั้งหมด';
            let alertType: 'error' | 'warning' = 'error';
            
            if (error.code === 'NOT_STREAMING') {
                userMessage = 'ไม่ได้สตรีมอยู่ (อัปเดท UI แล้ว)';
                alertType = 'warning';
            } else if (error.message?.includes('Connection') || error.message?.includes('WebSocket')) {
                userMessage = 'การเชื่อมต่อ OBS หลุด แต่อัปเดท UI แล้ว (อาจหยุดสตรีมแล้ว)';
                alertType = 'warning';
            } else if (error.message?.includes('timeout')) {
                userMessage = 'หมดเวลารอ OBS ตอบกลับ แต่อัปเดท UI แล้ว';
                alertType = 'warning';
            } else {
                userMessage = `ข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'} (อัปเดท UI แล้ว)`;
                alertType = 'warning';
            }
            
            setModal({ type: 'alert', props: { message: userMessage, alertType } });
        }
    }, [appState.obsStatus, setModal, obs, dispatch, stopStreamTimer]);


const handleStartStream = async () => {
    if (appState.obsStatus !== 'connected') {
        setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
        return;
    }
    if (appState.isStreaming) {
        setModal({ type: 'alert', props: { message: 'กำลังสตรีมอยู่แล้ว', alertType: 'info' } });
        return;
    }

    try {
        // 🔧 ตั้งค่า OBS Stream Service ให้ส่งไป RTMP Server อัตโนมัติ
        console.log("Setting up OBS Stream Service for RTMP Server...");
        await obs.current.call('SetStreamServiceSettings', {
            streamServiceType: 'rtmp_custom',
            streamServiceSettings: {
                server: 'rtmp://127.0.0.1:1935/live',
                key: 'my-stream-key'
            }
        });
        
        console.log("OBS Stream Service configured successfully!");
        
        const streamConfig = {
            twitchUrl: localStorage.getItem('twitch-key') ? 'rtmp://live-sjc.twitch.tv/app/' + localStorage.getItem('twitch-key') : '',
            youtubeUrl: localStorage.getItem('youtube-key') ? 'rtmp://a.rtmp.youtube.com/live2/' + localStorage.getItem('youtube-key') : ''
        };

        const destinations = [streamConfig.twitchUrl, streamConfig.youtubeUrl].filter(Boolean);
        //const srtInput = 'srt://localhost:10000?mode=caller&latency=1000';
        const rtmpInput = 'rtmp://127.0.0.1/live/my-stream-key';
        const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';

        // 1. สั่งให้ OBS เริ่มสตรีม
        console.log("Attempting to start OBS stream...");
        await obs.current.call('StartStream');

        // 2. รอจนกว่า OBS จะเริ่มสตรีมจริงๆ
        let isStreamActive = false;
        let attemptCount = 0;
        const maxAttempts = 10;
        const checkInterval = 1000; // ตรวจสอบทุก 1 วินาที

        while (!isStreamActive && attemptCount < maxAttempts) {
            console.log(`Checking stream status... (Attempt ${attemptCount + 1}/${maxAttempts})`);
            const status = await obs.current.call('GetStreamStatus');
            isStreamActive = status.outputActive;
            if (!isStreamActive) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            attemptCount++;
        }

        if (!isStreamActive) {
            console.error("OBS stream did not start after multiple attempts.");
            setModal({ type: 'alert', props: { message: 'ไม่สามารถสั่งให้ OBS เริ่มสตรีมได้ โปรดตรวจสอบการตั้งค่าและลองใหม่อีกครั้ง', alertType: 'error' } });
            return;
        }

        console.log("OBS stream started successfully. RTMP Server should now relay to YouTube!");
        setModal({ type: 'alert', props: { message: 'เริ่มสตรีมสำเร็จแล้ว! กำลังส่งไป YouTube ผ่าน RTMP Server', alertType: 'success' } });

    } catch (error: any) {
        console.error("❌ Failed to start stream:", error);
        let errorMessage = error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
        if (error.code === 'NOT_CONFIGURED') {
            errorMessage = 'ยังไม่ได้ตั้งค่า Stream Service ใน OBS. กรุณาตั้งค่า Server/Key ก่อน';
        }
        setModal({ type: 'alert', props: { message: `ไม่สามารถเริ่มไลฟ์ได้: ${errorMessage}`, alertType: 'error' } });
    }
};
    const handleStopStream = useCallback(async () => {
        console.log('🛑 Stop Stream button clicked');
        
        // ตรวจสอบการเชื่อมต่อ OBS
        if (appState.obsStatus !== 'connected') {
            console.error('❌ OBS not connected');
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }

        // ตรวจสอบว่า OBS WebSocket object พร้อมใช้งาน
        if (!obs.current || !obs.current.identified) {
            console.error('❌ OBS WebSocket not ready');
            setModal({ type: 'alert', props: { message: 'OBS WebSocket ไม่พร้อม กรุณาเชื่อมต่อใหม่', alertType: 'error' } });
            return;
        }

        console.log('✅ Starting stop stream process...');
        
        try {
            // 1. ตรวจสอบสถานะปัจจุบันของ stream
            let currentStatus = null;
            try {
                console.log('🔍 Checking current stream status...');
                currentStatus = await obs.current.call('GetStreamStatus');
                console.log('📊 Current stream status:', {
                    outputActive: currentStatus?.outputActive,
                    outputReconnecting: currentStatus?.outputReconnecting,
                    outputTimecode: currentStatus?.outputTimecode
                });
            } catch (statusError: any) {
                console.warn('⚠️ Could not get stream status:', statusError.message);
                // ต่อไปด้วยการพยายามหยุด stream ยังไง
            }

            // 2. ตรวจสอบว่าจำเป็นต้องหยุดหรือไม่
            if (currentStatus && !currentStatus.outputActive) {
                console.log('ℹ️ Stream is already stopped, updating UI state');
                dispatch({ type: 'SET_STREAM_STATE', payload: false });
                stopStreamTimer();
                setModal({ type: 'alert', props: { message: 'สตรีมหยุดอยู่แล้ว (อัพเดทสถานะ UI)', alertType: 'info' } });
                return;
            }

            // 3. ส่งคำสั่งหยุด stream
            console.log('🛑 Sending stop stream command to OBS...');
            const stopResult = await obs.current.call('StopStream');
            console.log('📤 Stop stream command sent:', stopResult);
            
            // 4. รอและตรวจสอบว่าหยุดจริงแล้ว
            console.log('⏳ Waiting for stream to stop completely...');
            let stopConfirmed = false;
            let verificationAttempts = 0;
            const maxVerificationAttempts = 10; // เพิ่มจาก 5 เป็น 10
            
            while (!stopConfirmed && verificationAttempts < maxVerificationAttempts) {
                await new Promise(resolve => setTimeout(resolve, 300)); // ลดเวลารอจาก 500ms เป็น 300ms
                
                try {
                    const verifyStatus = await obs.current.call('GetStreamStatus');
                    console.log(`🔍 Verification attempt ${verificationAttempts + 1}:`, {
                        outputActive: verifyStatus?.outputActive,
                        outputReconnecting: verifyStatus?.outputReconnecting
                    });
                    
                    if (!verifyStatus.outputActive) {
                        console.log('✅ Stream confirmed stopped');
                        stopConfirmed = true;
                        break;
                    }
                } catch (verifyError: any) {
                    console.log(`⚠️ Verification attempt ${verificationAttempts + 1} failed:`, verifyError.message);
                    // ถ้าตรวจสอบไม่ได้หลายครั้ง ถือว่าหยุดแล้ว
                    if (verificationAttempts >= 3) {
                        console.log('🤷 Cannot verify status multiple times, assuming stopped');
                        stopConfirmed = true;
                        break;
                    }
                }
                verificationAttempts++;
            }
            
            // 5. อัพเดท UI state และแจ้งผลลัพธ์
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            if (stopConfirmed) {
                console.log('🎉 Stream stopped successfully');
                setModal({ type: 'alert', props: { message: 'หยุดสตรีมสำเร็จแล้ว!', alertType: 'success' } });
            } else {
                console.log('⚠️ Stop command sent but could not verify completion');
                setModal({ type: 'alert', props: { message: 'ส่งคำสั่งหยุดแล้ว แต่ไม่สามารถยืนยันได้ กรุณาตรวจสอบ OBS', alertType: 'warning' } });
            }
            
        } catch (error: any) {
            console.error('❌ Error during stop stream process:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            // อัพเดท UI state เพื่อป้องกันการติดค้าง
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            stopStreamTimer();
            
            // จัดการข้อผิดพลาดตามประเภท
            let userMessage = 'เกิดข้อผิดพลาดขณะหยุดสตรีม';
            let alertType: 'error' | 'warning' = 'error';
            
            if (error.code === 'REQUEST_NOT_READY') {
                userMessage = 'OBS ยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่';
            } else if (error.code === 'NOT_STREAMING') {
                userMessage = 'ไม่มีการสตรีมที่ต้องหยุด (อัพเดท UI แล้ว)';
                alertType = 'warning';
            } else if (error.message?.includes('Connection') || error.message?.includes('WebSocket')) {
                userMessage = 'การเชื่อมต่อ OBS หลุด แต่อัพเดท UI แล้ว (อาจหยุดสตรีมแล้ว)';
                alertType = 'warning';
            } else if (error.message?.includes('timeout')) {
                userMessage = 'หมดเวลารอ OBS ตอบกลับ แต่อัพเดท UI แล้ว';
                alertType = 'warning';
            } else {
                userMessage = `ข้อผิดพลาด: ${error.message || 'ไม่ทราบสาเหตุ'} (อัพเดท UI แล้ว)`;
                alertType = 'warning';
            }
            
            setModal({ type: 'alert', props: { message: userMessage, alertType } });
        }
    }, [appState.obsStatus, setModal, dispatch, stopStreamTimer]);

    const handleCheckStreamSettings = useCallback(async () => {
        if (appState.obsStatus !== 'connected') return;
        try {
            const { streamServiceSettings } = await obs.current.call('GetStreamServiceSettings');
            const { server, key } = streamServiceSettings;
            setModal({ type: 'alert', props: { message: `Server: ${server}\nKey: ${key ? '******' : 'ไม่ได้ตั้งค่า'}`, alertType: 'info' } });
        } catch (error) {
            setModal({ type: 'alert', props: { message: 'ไม่สามารถตรวจสอบการตั้งค่าได้', alertType: 'error' } });
        }
    }, [appState.obsStatus, setModal]);

    const handleShowProduct = useCallback(() => {
        if (appState.selectedProductId === null) {
            setModal({ type: 'alert', props: { message: 'กรุณาเลือกสินค้าก่อน', alertType: 'info' } });
            return;
        }
        const product = appState.products.find(p => p.id === appState.selectedProductId);
        if (product) {
            if (productOverlayTimerRef.current) clearTimeout(productOverlayTimerRef.current);
            dispatch({ type: 'SET_STATE', payload: { overlayProduct: product } });
            productOverlayTimerRef.current = window.setTimeout(() => {
                dispatch({ type: 'SET_STATE', payload: { overlayProduct: null } });
            }, 5000);
        }
    }, [appState.selectedProductId, appState.products, dispatch, setModal]);

    const handleSaveProduct = useCallback((product: Omit<Product, 'id'>, id?: number) => {
        let newProducts;
        if (id) {
            newProducts = appState.products.map(p => p.id === id ? { ...p, ...product, id } : p);
        } else {
            newProducts = [...appState.products, { ...product, id: Date.now() }];
        }
        localStorage.setItem('products', JSON.stringify(newProducts));
        dispatch({ type: 'SET_STATE', payload: { products: newProducts } });
        setModal({ type: null }); // ปิด modal ก่อนแจ้ง alert
        setModal({ type: 'alert', props: { message: id ? 'แก้ไขข้อมูลสำเร็จ!' : 'เพิ่มสินค้าสำเร็จ!', alertType: 'success' } });
    }, [appState.products, dispatch, setModal]);

    const handleDeleteProduct = useCallback((id: number) => {
        setModal({
            type: 'confirm',
            props: {
                message: 'คุณต้องการลบสินค้านี้ใช่หรือไม่?',
                onConfirm: () => {
                    const newProducts = appState.products.filter(p => p.id !== id);
                    localStorage.setItem('products', JSON.stringify(newProducts));
                    const newSelectedId = appState.selectedProductId === id ? null : appState.selectedProductId;
                    dispatch({ type: 'SET_STATE', payload: { products: newProducts, selectedProductId: newSelectedId } });
                    setModal({ type: 'alert', props: { message: 'ลบสินค้าเรียบร้อยแล้ว', alertType: 'success' } });
                }
            }
        });
    }, [appState.products, appState.selectedProductId, dispatch, setModal]);

    const handleSendComment = useCallback((text: string) => {
        if (!text.trim()) return;
        const newComment: Comment = {
            id: Date.now(),
            platform: 'host',
            user: 'ผู้ดำเนินรายการ',
            text,
            icon: <FaMicrophone />,
            color: 'text-cyan-400'
        };
        dispatch({ type: 'SET_STATE', payload: {
            comments: [newComment, ...appState.comments].slice(0, 50),
            analytics: {
                ...appState.analytics,
                totalComments: appState.analytics.totalComments + 1
            }
        }});
    }, [appState.comments, appState.analytics, dispatch]);

    const handleAddScene = useCallback(async (sceneName: string) => {
        if (!obs.current.identified) {
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }
        try {
            await obs.current.call('CreateScene', { sceneName });
            setModal({ type: 'alert', props: { message: `เพิ่ม Scene "${sceneName}" สำเร็จ!`, alertType: 'success' } });
            setSceneModal({ type: null });
        } catch (e: any) {
            console.error('Failed to add scene:', e);
            setModal({ type: 'alert', props: { message: `ไม่สามารถเพิ่ม Scene ได้: ${e.message || 'เกิดข้อผิดพลาด'}`, alertType: 'error' } });
        }
    }, [setModal]);

    const handleRemoveScene = useCallback(async (sceneName: string) => {
        if (!obs.current.identified) {
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' } });
            return;
        }
        setModal({
            type: 'confirm',
            props: {
                message: `คุณต้องการลบ Scene "${sceneName}" ใช่หรือไม่?`,
                onConfirm: async () => {
                    try {
                        await obs.current.call('RemoveScene', { sceneName });
                        setModal({ type: 'alert', props: { message: `ลบ Scene "${sceneName}" สำเร็จ!`, alertType: 'success' } });
                    } catch (e: any) {
                        console.error('Failed to remove scene:', e);
                        setModal({ type: 'alert', props: { message: `ไม่สามารถลบ Scene ได้: ${e.message || 'เกิดข้อผิดพลาด'}`, alertType: 'error' } });
                    }
                }
            }
        });
    }, [setModal]);


    const handleConnectRestream = useCallback(async () => {
        try {
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/auth/restream`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend Error Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                setModal({ type: 'alert', props: { message: 'ไม่สามารถสร้าง URL สำหรับเชื่อมต่อ Restream ได้', alertType: 'error' } });
            }
        } catch (error) {
            console.error('Error initiating Restream OAuth:', error);
            let errorMessage = 'ไม่ทราบข้อผิดพลาด';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else {
                errorMessage = String(error);
            }
            setModal({ type: 'alert', props: { message: `เกิดข้อผิดพลาดในการเริ่มต้นเชื่อมต่อ Restream: ${errorMessage}`, alertType: 'error' } });
        }
    }, [BACKEND_API_BASE_URL, setModal]);


    const obsStatusMap = {
        connected: { text: 'Connected', iconColor: 'bg-green-500' },
        connecting: { text: 'Connecting', iconColor: 'bg-yellow-500 animate-pulse' },
        failed: { text: 'Failed', iconColor: 'bg-red-500' },
        disconnected: { text: 'Disconnected', iconColor: 'bg-gray-400' }
    };
    const currentObsStatus = obsStatusMap[appState.obsStatus];

    return (
        <div className={`bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 min-h-screen font-sans`}>
            <div className="flex flex-col h-screen">
                <header className="text-center mb-6 relative pt-4 lg:pt-6 px-4 lg:px-6">
                    <div className="flex items-center justify-center gap-x-4">
                        <h1 className="text-3xl lg:text-xl font-bold text-gray-900 dark:text-white">🔴 Multi-Platform Live Streaming</h1>
                        <div onClick={() => dispatch({ type: 'SET_STATE', payload: { activeRightTab: 'settings' } })} className="flex items-center justify-center gap-2 text-xl font-semibold px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 cursor-pointer">
                            <span className={`w-3 h-3 rounded-lg ${currentObsStatus.iconColor}`}></span>
                            <span>{currentObsStatus.text}</span>
                        </div>
                    </div>
                    <button onClick={() => setIsDarkMode(prev => !prev)} className="absolute top-0 right-0 mt-4 mr-4 p-3 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                        {isDarkMode ? <FaSun className="text-xl" /> : <FaMoon className="text-xl" />}
                    </button>
                </header>

                <main className="flex-1 grid grid-cols-12 grid-rows-[1fr_auto] portrait:grid-rows-[2fr_1fr_auto] gap-6 min-h-0 px-4 lg:px-6 pb-4 lg:pb-6">

                    {/* --- ProductPanel (จัดการสินค้า) --- */}
                    <div className="col-span-3 row-span-1 portrait:col-span-8 portrait:row-start-2 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                        <ProductPanel
                            products={appState.products}
                            selectedProductId={appState.selectedProductId}
                            onSelectProduct={(id) => dispatch({ type: 'SET_STATE', payload: { selectedProductId: id } })}
                            onAddProduct={() => setModal({ type: 'product', props: { onSave: handleSaveProduct } })}
                            onEditProduct={(product) => setModal({ type: 'product', props: { product, onSave: handleSaveProduct } })}
                            onDeleteProduct={handleDeleteProduct}
                            onShowProduct={handleShowProduct}
                        />
                    </div>

                    {/* --- StreamPanel (กล้อง) --- */}
                    <div className="col-start-4 col-span-6 row-span-1 portrait:col-start-1 portrait:col-span-8 portrait:row-start-1 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                        <StreamPanel
                            isStreaming={appState.isStreaming}
                            streamTime={appState.streamTime}
                           // runningText={appState.runningText}
                            overlayProduct={appState.overlayProduct}
                            videoRef={videoRef}
                            onStartStream={handleStartStream}
                            onStopStream={handleStopStream}
                            onStartMultiOutput={startSpecificMultiOutput}
                            onStopMultiOutput={stopSpecificMultiOutput}
                            onStartAllMultiOutputs={startAllMultiOutputs}
                            onStopAllMultiOutputs={stopAllMultiOutputs}
                            onCheckSettings={handleCheckStreamSettings}
                            isObsConnected={appState.obsStatus === 'connected'}
                            onOpenStreamDetails={handleOpenStreamDetails}
                        />
                    </div>

                    {/* --- RightPanel (คอมเมนต์) --- */}
                    <div className="col-start-10 col-span-3 row-span-1 portrait:col-start-9 portrait:col-span-4 portrait:row-span-3 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                        <RightPanel
                            activeTab={appState.activeRightTab}
                            setActiveTab={(tab) => dispatch({ type: 'SET_STATE', payload: { activeRightTab: tab } })}
                            obsStatus={appState.obsStatus}
                            comments={appState.comments}
                            analytics={appState.analytics}
                          //  runningText={appState.runningText}
                            streamTitle={appState.streamTitle}
                            onConnectOBS={handleConnectOBS}
                            onDisconnectOBS={handleDisconnectOBS}
                            onSendComment={handleSendComment}
                          //  onUpdateRunningText={(text) => dispatch({ type: 'SET_STATE', payload: { runningText: text } })}
                            onUpdateStreamTitle={(title) => dispatch({ type: 'SET_STATE', payload: { streamTitle: title } })}
                            onOpenPlatformSettings={(platform) => setModal({type: 'settings', props: { platform }})}
                            onSetModal={setModal}
                            restreamChannels={appState.restreamChannels}
                            onFetchRestreamChannels={fetchRestreamChannels} // <-- ยังคงส่ง prop นี้
                            onToggleRestreamChannel={handleToggleRestreamChannel}
                            chatToken={chatToken}
                            handleConnectRestream={handleConnectRestream}
                            platform={appState.activeRightTab}
                            onOpenStreamDetails={handleOpenStreamDetails}
                            onStartMultiOutput={startSpecificMultiOutput}
                            onStopMultiOutput={stopSpecificMultiOutput}
                            onStartAllMultiOutputs={startAllMultiOutputs}
                            onStopAllMultiOutputs={stopAllMultiOutputs}
                        />
                    </div>

                    {/* --- ObsManagementPanel --- */}
                    <div className="col-span-12 row-start-2 portrait:col-span-8 portrait:row-start-3 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                        <ObsManagementPanel
                            scenes={appState.scenes}
                            currentSceneName={appState.currentSceneName}
                            sources={appState.sources}
                            audioInputs={appState.audioInputs}
                            onSceneSelect={handleSetCurrentScene}
                            onToggleVisibility={handleToggleSourceVisibility}
                            onToggleMute={handleToggleMute}
                            onAddScene={() => setSceneModal({ type: 'add' })}
                            onRemoveScene={handleRemoveScene}
                        />
                    </div>
                </main>

                {modal.type === 'alert' && <AlertModal {...modal.props} onClose={() => setModal({ type: null })} />}
                {modal.type === 'confirm' && <ConfirmModal {...modal.props} onClose={() => setModal({ type: null })} />}
                {modal.type === 'product' && <ProductModal {...modal.props} onClose={() => setModal({ type: null })} />}
                {modal.type === 'settings' && <SettingsModal {...modal.props} obs={obs.current} isConnected={appState.obsStatus === 'connected'} onClose={() => setModal({type: null, props: { message: 'อัปเดตข้อความวิ่งแล้ว', alertType: 'success' }})} onAlert={(props) => setModal({type: 'alert', props})} handleConnectRestream={handleConnectRestream} />}
                {streamDetailsModal && streamDetailsModal.isOpen && (
                    <StreamDetailsModal
                        onClose={() => setStreamDetailsModal(null)}
                        onSave={handleUpdateStreamDetails}
                        currentTitle={streamDetailsModal.currentTitle}
                        currentDescription={streamDetailsModal.currentDescription}
                        primaryChannelId={streamDetailsModal.primaryChannelId}
                    />
                )}
                {sceneModal.type === 'add' && <AddSceneModal onAdd={handleAddScene} onClose={() => setSceneModal({ type: null })} />}

            </div>
        </div>
    );
};

// ====================================================================
// UI Components
// ====================================================================

const AddSceneModal: FC<{ onAdd: (sceneName: string) => void; onClose: () => void; }> = ({ onAdd, onClose }) => {
    const [sceneName, setSceneName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sceneName.trim()) {
            onAdd(sceneName.trim());
        } else {
            alert('กรุณากรอกชื่อ Scene');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">เพิ่ม Scene ใหม่</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white text-2xl">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="new-scene-name" className="block text-sm font-medium mb-1">ชื่อ Scene:</label>
                        <input
                            type="text"
                            id="new-scene-name"
                            value={sceneName}
                            onChange={(e) => setSceneName(e.target.value)}
                            className="w-full p-2 border rounded-md bg-gray-100 dark:bg-gray-700"
                            placeholder="เช่น My New Scene"
                            required
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold">ยกเลิก</button>
                        <button type="submit" className="py-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold">เพิ่ม Scene</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProductPanel: FC<{
    products: Product[];
    selectedProductId: number | null;
    onSelectProduct: (id: number) => void;
    onAddProduct: () => void;
    onEditProduct: (product: Product) => void;
    onDeleteProduct: (id: number) => void;
    onShowProduct: () => void;
}> = ({ products, selectedProductId, onSelectProduct, onAddProduct, onEditProduct, onDeleteProduct, onShowProduct }) => {
    const [filter, setFilter] = useState<'all' | 'featured' | 'sale'>('all');
    const filteredProducts = products.filter(p => filter === 'all' || p.category === filter);

    return (
        <>
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center"><FaBoxOpen className="mr-3 text-blue-500" />จัดการสินค้า</h3>
            <div className="flex space-x-2 mb-4">
                {(['all', 'featured', 'sale'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`filter-btn flex-1 rounded-lg py-1 px-2 font-semibold ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        {f === 'all' ? 'ทั้งหมด' : f === 'featured' ? 'แนะนำ' : 'ลดราคา'}
                    </button>
                ))}
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredProducts.length > 0 ? filteredProducts.map(p => (
                    <div key={p.id} className={`flex items-center p-2 rounded-lg transition-colors cursor-pointer ${selectedProductId === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <div className="text-2xl w-10 text-center">{p.icon}</div>
                        <div className="flex-grow ml-3" onClick={() => onSelectProduct(p.id)}>
                            <div className="font-bold">{p.name}</div>
                            <div className={`text-sm ${selectedProductId === p.id ? 'text-yellow-300' : 'text-yellow-500'}`}>฿{p.price.toLocaleString()}</div>
                        </div>
                        <button onClick={() => onEditProduct(p)} className="p-2 text-gray-400 hover:text-blue-500"><FaPencil /></button>
                        <button onClick={() => onDeleteProduct(p.id)} className="p-2 text-gray-400 hover:text-red-500"><FaTrash /></button>
                    </div>
                )) : <div className="text-center text-gray-500 py-10">ไม่มีสินค้า</div>}
            </div>
            <div className="mt-auto pt-4 grid grid-cols-2 gap-3">
                <button onClick={onAddProduct} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold  px-4 rounded-lg flex items-center justify-center"><FaPlus className="mr-2" />เพิ่มสินค้า</button>
                <button onClick={onShowProduct} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold  px-4 rounded-lg flex items-center justify-center"><FaEye className="mr-2" />แสดงสินค้า</button>
            </div>
        </>
    );
};

const StreamPanel: FC<{
    isStreaming: boolean;
    streamTime: string;
   // runningText: string;
    overlayProduct: Product | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    onStartStream: () => void;
    onStopStream: () => void;
    onCheckSettings: () => void;
    isObsConnected: boolean;
    onOpenStreamDetails: () => void;
    onStartMultiOutput: (targetName: string) => Promise<void>;
    onStopMultiOutput: (targetName: string) => Promise<void>;
    onStartAllMultiOutputs: () => Promise<void>;
    onStopAllMultiOutputs: () => Promise<void>;
}> = (props) => {
    const {
        isStreaming,
        streamTime,
       // runningText,
        overlayProduct,
        videoRef,
        // onStartStream,
        // onStopStream,
        // onCheckSettings,
        // isObsConnected,
        // onOpenStreamDetails, // ไม่ได้ใช้ตรงๆ ใน StreamPanel UI
    } = props;

    return (
        <>
            <div className="flex-grow bg-black rounded-lg relative overflow-hidden min-h-0">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline></video>
                <div className="absolute top-3 left-3 px-3 py-1 text-sm font-bold text-white rounded-full transition-all ${isStreaming ? 'bg-red-600 pulse-live-animation' : 'bg-gray-500'}">
                    {isStreaming ? 'LIVE' : 'OFFLINE'}
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1 text-sm font-bold text-white rounded bg-black/50">{streamTime}</div>
                {overlayProduct && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white p-3 rounded-lg text-center animate-fade-in">
                        <div className="font-bold">{overlayProduct.name}</div>
                        <div className="text-lg text-yellow-400 font-bold">฿{overlayProduct.price.toLocaleString()}</div>
                    </div>
                )}
                {/* <div className="absolute bottom-12 w-full bg-black/60 overflow-hidden whitespace-nowrap">
                    {<div className="inline-block py-2 text-white font-semibold animate-scroll-left">{runningText}</div>}
                </div> */}
            </div>
            {/* <div className="mt-auto pt-4 grid grid-cols-3 gap-3">
                <button onClick={onStartStream} disabled={!isObsConnected || isStreaming} className="control-btn bg-green-600 hover:bg-green-700 rounded-lg text-white px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaPlay className="mr-2" />เริ่มไลฟ์</button>
                <button onClick={onStopStream} disabled={!isObsConnected || !isStreaming} className="control-btn bg-red-600 hover:bg-red-700 rounded-lg text-white px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaStop className="mr-2" />หยุดไลฟ์</button>
                <button onClick={onCheckSettings} disabled={!isObsConnected} className="control-btn bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaCheckDouble className="mr-2" />ตรวจสอบค่า</button>
            </div> */}
        </>
    );

};

const RightPanel: FC<{
    activeTab: AppState['activeRightTab'];
    setActiveTab: (tab: AppState['activeRightTab']) => void;
    obsStatus: AppState['obsStatus'];
    comments: Comment[];
    analytics: AppState['analytics'];
  //  runningText: string;
    streamTitle: string;
    onConnectOBS: (ip: string, port: string, pass: string, save: boolean) => void;
    onDisconnectOBS: () => void;
    onSendComment: (text: string) => void;
 //   onUpdateRunningText: (text: string) => void;
    onUpdateStreamTitle: (title: string) => void;
    onOpenPlatformSettings: (platform: string) => void;
    onSetModal: React.Dispatch<React.SetStateAction<{ type: 'alert' | 'confirm' | 'product' | 'settings' | 'streamDetails' | null; props?: any }>>;
    restreamChannels: RestreamChannel[];
    onFetchRestreamChannels: () => void; // <-- ยังคงเป็น prop ของ RightPanel
    onToggleRestreamChannel: (channelId: number, currentEnabledState: boolean) => void;
    chatToken: string | null;
    handleConnectRestream: () => void;
    platform: string; // อันนี้คือ activeTab ของ RightPanel, แต่ตั้งชื่อ prop เป็น platform
    onOpenStreamDetails: () => void;
    onStartMultiOutput: (targetName: string) => void;
    onStopMultiOutput: (targetName: string) => void;
    onStartAllMultiOutputs: () => void;
    onStopAllMultiOutputs: () => void;
}> = (props) => {
const {
    activeTab, // <--- ใช้ activeTab ที่ destructure มา
    setActiveTab,
    onSetModal,
    onSendComment,
    restreamChannels,
    onFetchRestreamChannels, // <-- ยังคง destructure มา เพราะถูกส่งให้ ChannelsTab และ SettingsTab
    onToggleRestreamChannel,
    chatToken,
    comments,
    onOpenStreamDetails,
    onStartMultiOutput,
    onStopMultiOutput,
    onStartAllMultiOutputs,
    onStopAllMultiOutputs,
    obsStatus,
    onConnectOBS,
    onDisconnectOBS,
    // props ที่ส่งให้ SettingsTab/DisplaySettings:
   // runningText,
    streamTitle,
   // onUpdateRunningText,
    onUpdateStreamTitle,
    onOpenPlatformSettings,
    handleConnectRestream,
    // platform, // ไม่ต้อง destructure เพราะเป็นค่าเดียวกับ activeTab
} = props;
    const tabs = [
        { id: 'comments', name: 'คอมเมนต์', icon: <FaComments /> },
        { id: 'channels', name: 'ช่องสตรีม', icon: <FaGlobe /> },
        { id: 'settings', name: 'ตั้งค่า', icon: <FaGear /> },
    ] as const;

    return (
        <div className="flex flex-col h-full"> {/* ใช้ flex-col และ h-full เพื่อจัดการความสูง */}
            {/* Tab Navigation */}
            <div className="flex justify-around bg-gray-200 dark:bg-gray-700 p-2 rounded-xl mb-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-semibold transition-colors
                            ${activeTab === tab.id ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                    >
                        {tab.icon}
                        <span className="ml-2">{tab.name}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2"> {/* เพิ่ม overflow-y-auto และ p-2 */}
                {activeTab === 'comments' && (
                    <CommentsTab
                        comments={comments}
                        onSendComment={onSendComment}
                        chatToken={chatToken}
                    />
                )}
                {activeTab === 'channels' && (
                    <ChannelsTab
                        restreamChannels={restreamChannels}
                        onFetchRestreamChannels={onFetchRestreamChannels}
                        onToggleChannelEnabled={onToggleRestreamChannel}
                        onOpenStreamDetails={onOpenStreamDetails}
                    />
                )}
                {activeTab === 'settings' && (
                    <SettingsTab
                        obsStatus={obsStatus}
                       // runningText={runningText}
                        streamTitle={streamTitle}
                        onConnectOBS={onConnectOBS}
                        onDisconnectOBS={onDisconnectOBS}
                       // onUpdateRunningText={onUpdateRunningText}
                        onUpdateStreamTitle={onUpdateStreamTitle}
                        onOpenPlatformSettings={onOpenPlatformSettings}
                        onSetModal={onSetModal}
                        onFetchRestreamChannels={onFetchRestreamChannels}
                        handleConnectRestream={handleConnectRestream}
                        onStartMultiOutput={onStartMultiOutput}
                        onStopMultiOutput={onStopMultiOutput}
                        onStartAllMultiOutputs={onStartAllMultiOutputs}
                        onStopAllMultiOutputs={onStopAllMultiOutputs}
                    />
                )}
            </div>
        </div>
    );
};

const CommentsTab: FC<{ comments: Comment[]; onSendComment: (text: string) => void; chatToken: string | null; }> = ({ comments, onSendComment, chatToken }) => {
    const [commentInput, setCommentInput] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const embedUrl = chatToken;

    useEffect(() => {
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [comments]);

    const handleSend = () => {
        if (commentInput.trim()) {
            onSendComment(commentInput.trim());
            setCommentInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-grow">
                {embedUrl ? (
                    <iframe
                        src={embedUrl}
                        frameBorder="0"
                        className="w-full h-full"
                        title="Restream Embedded Chat"
                    ></iframe>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <p>เชื่อมต่อ Restream เพื่อดูแชทสด...</p>
                    </div>
                )}
            </div>
            <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center">
                <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="พิมพ์ข้อความตอบกลับ..."
                    className="flex-grow p-2 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleSend}
                    className="ml-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    title="ส่งข้อความ"
                >
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
};

interface ChannelsTabProps {
    restreamChannels: RestreamChannel[];
    onFetchRestreamChannels: () => void;
    onToggleChannelEnabled: (channelId: number, currentEnabledState: boolean) => void;
    onOpenStreamDetails: () => void;
}
const ChannelsTab: FC<ChannelsTabProps> = ({ restreamChannels, onFetchRestreamChannels, onToggleChannelEnabled, onOpenStreamDetails }) => {
    const [isToggling, setIsToggling] = useState<number | null>(null);

    useEffect(() => {
        onFetchRestreamChannels();
    }, [onFetchRestreamChannels]);

// ... ใน ChannelsTab
const getPlatformIcon = (platformName: string) => {
    switch (platformName) {
        case 'Facebook': return <FaFacebookF className="text-blue-600" />;
        case 'YouTube': return <FaYoutube className="text-red-600" />;
        case 'Twitch': return <FaTwitch className="text-purple-600" />; // แก้ไขตรงนี้
        case 'X (Twitter)': return <FaTiktok className="text-gray-800 dark:text-white" />; // ถ้ามี FaXTwitter ให้ใช้ FaXTwitter
        case 'TikTok': return <FaTiktok className="text-black dark:text-white" />;
        case 'Shopee': return <SiShopee style={{ color: '#EE4D2D' }} />; // เพิ่ม Shopee ด้วย
        default: return <FaGlobe className="text-gray-500" />;
    }
};

    const handleToggleAndLoad = async (channelId: number, currentEnabledState: boolean) => {
        setIsToggling(channelId);
        try {
            await onToggleChannelEnabled(channelId, currentEnabledState);
        } finally {
            setIsToggling(null);
        }
    };

    const handleViewLive = (channel: RestreamChannel) => {
        if (channel.status === 'online' && channel.url) {
            window.open(channel.url, '_blank');
        } else if (channel.status === 'offline') {
            alert('ไม่ได้ไลฟ์สดในขณะนี้');
        } else {
            console.warn('Channel URL is not available or status is not online.', channel);
        }
    };
    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-4">
                <button className="flex-1 py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold flex items-center justify-center text-sm">
                    <FaPlus className="mr-2" /> Add Channel
                </button>
                <button
                    onClick={onOpenStreamDetails}
                    className="flex-1 py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold flex items-center justify-center text-sm">
                    <FaPencil className="mr-2" /> Update Titles
                </button>
            </div>

            <div className="flex justify-end items-center text-sm text-gray-500 dark:text-gray-400">
                <span>Toggle all</span>
                <button className="ml-2 px-2 py-1 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white text-xs font-semibold">OFF</button>
                <button className="ml-1 px-2 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold">ON</button>
            </div>

            {restreamChannels.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-10">
                    ยังไม่มีช่องสตรีม Restream หรือยังไม่ได้เชื่อมต่อ.
                    <br />ไปที่ <span className="font-semibold text-blue-500 cursor-pointer" onClick={() => {/* logic to switch to settings tab */}}>ตั้งค่า</span> เพื่อเชื่อมต่อ.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {restreamChannels.map(channel => (
                        <div key={channel.id} className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xl overflow-hidden">
                                    {channel.platform === 'YouTube' ? getPlatformIcon(channel.platform) :
                                     channel.platform === 'Facebook' ? getPlatformIcon(channel.platform) :
                                     <FaUsers className="text-gray-500 dark:text-gray-300" />}
                                </div>

                                <div>
                                    <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                        <span>{channel.name}</span>
                                        {channel.status === 'online' ? (
                                            <span className="text-green-500 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-800">Live</span>
                                        ) : (
                                            <span className="text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">Offline</span>
                                        )}
                                        {channel.privacy === 'public' && <span className="text-blue-500 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800">Public</span>}
                                    </div>
                                    <div
                                             className={`text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1 ${channel.status === 'online' ? 'cursor-pointer hover:underline' : 'cursor-not-allowed'}`}
                                             onClick={() => handleViewLive(channel)}>
                                             {getPlatformIcon(channel.platform)}
                                             <span>ดูไลฟ์สด...</span>
                                     </div>
                                </div>
                            </div>

                            <label htmlFor={`toggle-${channel.id}`} className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id={`toggle-${channel.id}`}
                                    className="sr-only peer"
                                    checked={channel.enabled}
                                    onChange={() => handleToggleAndLoad(channel.id, channel.enabled)}
                                    disabled={isToggling === channel.id}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                {isToggling === channel.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-500/50 rounded-full">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
const DisplaySettings: FC<{streamTitle: string; onStreamTitleChange: (text: string) => void; onUpdate: () => void}> = ({ streamTitle,  onStreamTitleChange }) => {
    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">ตั้งค่าการแสดงผล</h3>
            <div>
                <label htmlFor="stream-title-input" className="block mb-2 font-semibold">ชื่อเรื่องไลฟ์</label>
                <input type="text" id="stream-title-input" value={streamTitle} onChange={e => onStreamTitleChange(e.target.value)} placeholder="ใส่ชื่อเรื่องของไลฟ์สตรีม" className="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border" />
            </div>
        </div>
    );
};

// ====================================================================
// START: EDITED SECTION
// ====================================================================

const SettingsTab: FC<{
    obsStatus: AppState['obsStatus'];
   // runningText: string;
    streamTitle: string;
    onConnectOBS: (ip: string, port: string, pass: string, save: boolean) => void;
    onDisconnectOBS: () => void;
   // onUpdateRunningText: (text: string) => void;
    onUpdateStreamTitle: (title: string) => void;
    onOpenPlatformSettings: (platform: string) => void;
    onSetModal: React.Dispatch<React.SetStateAction<{ type: 'alert' | 'confirm' | 'product' | 'settings' | 'streamDetails' | null; props?: any }>>;
    onFetchRestreamChannels: () => void;
    handleConnectRestream: () => void;
    onStartMultiOutput: (targetName: string) => void;
    onStopMultiOutput: (targetName: string) => void;
    onStartAllMultiOutputs: () => void;
    onStopAllMultiOutputs: () => void;
}> = (props) => {
const {
    obsStatus,
    streamTitle,
    onConnectOBS,
    onDisconnectOBS,
    onUpdateStreamTitle,
    onOpenPlatformSettings,
    onSetModal,
    onFetchRestreamChannels,
    onStartMultiOutput,
    onStopMultiOutput,
    onStartAllMultiOutputs,
    onStopAllMultiOutputs
} = props;

    useEffect(() => {
        onFetchRestreamChannels();
    }, [onFetchRestreamChannels]);

    // Configuration for Multi-Output platforms
const multiOutputPlatforms = [
        {
            id: 'facebook',
            name: 'facebook',
            icon: <FaFacebookF className="text-blue-500" size={22} />,
            startBg: 'bg-facebookBlue hover:bg-facebookDarkBlue dark:bg-facebookBlueDark dark:hover:bg-facebookDarkBlueDark',
            stopBg: 'bg-facebookDarkBlue hover:bg-facebookBlue dark:bg-facebookDarkBlueDark dark:hover:bg-facebookBlueDark'
        },
        {
            id: 'youtube',
            name: 'youtube',
            icon: <FaYoutube className="text-red-500" size={22} />,
            startBg: 'bg-youtubeRed hover:bg-youtubeDarkRed dark:bg-youtubeRedDark dark:hover:bg-youtubeDarkRedDark',
            stopBg: 'bg-youtubeDarkRed hover:bg-youtubeRed dark:bg-youtubeDarkRedDark dark:hover:bg-youtubeRedDark'
        },
        {
            id: 'tiktok',
            name: 'tiktok',
            icon: <FaTiktok className="text-black dark:text-white" size={22} />,
            startBg: 'bg-tiktokBlack hover:bg-tiktokDarkGray dark:bg-tiktokBlackDark dark:hover:bg-tiktokDarkGrayDark',
            stopBg: 'bg-tiktokDarkGray hover:bg-tiktokBlack dark:bg-tiktokDarkGrayDark dark:hover:bg-tiktokBlackDark'
        },
        {
            id: 'twitch',
            name: 'twitch',
            icon: <FaTwitch className="text-purple-500" size={22} />,
            startBg: 'bg-twitchPurple hover:bg-twitchDarkPurple dark:bg-twitchPurpleDark dark:hover:bg-twitchDarkPurpleDark',
            stopBg: 'bg-twitchDarkPurple hover:bg-twitchPurple dark:bg-twitchDarkPurpleDark dark:hover:bg-twitchPurpleDark'
        },
        {
            id: 'shopee',
            name: 'shopee',
            icon: <SiShopee style={{ color: '#EE4D2D' }} size={22} />,
            startBg: 'bg-shopeeOrange hover:bg-shopeeDarkOrange dark:bg-shopeeOrangeDark dark:hover:bg-shopeeDarkOrangeDark',
            stopBg: 'bg-shopeeDarkOrange hover:bg-shopeeOrange dark:bg-shopeeDarkOrangeDark dark:hover:bg-shopeeOrangeDark'
        },
    ];

    return (
        <div className="space-y-6">
            <OBSSettings onConnect={onConnectOBS} onDisconnect={onDisconnectOBS} status={obsStatus} />

            <DisplaySettings
                streamTitle={streamTitle}
                onStreamTitleChange={onUpdateStreamTitle}
                onUpdate={() => {
                   onSetModal({type: 'alert', props: { message: 'อัปเดตข้อความวิ่งแล้ว', alertType: 'success' }});
               }}
            />

            {/* --- NEW & IMPROVED Multi-Output Controls --- */}
            <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg mt-4">
                <h3 className="font-semibold mb-3">ควบคุม Multi-Output และปลายทาง</h3>

                {/* --- General Controls --- */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                        onClick={onStartAllMultiOutputs}
                        disabled={obsStatus !== 'connected'}
                        className="control-btn bg-green-600 hover:bg-green-700 rounded-lg text-white px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    >
                        <FaPlay className="mr-2" /> Start All
                    </button>
                    <button
                        onClick={onStopAllMultiOutputs}
                        disabled={obsStatus !== 'connected'}
                        className="control-btn bg-red-600 hover:bg-red-700 rounded-lg text-white px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    >
                        <FaStop className="mr-2" /> Stop All
                    </button>
                </div>

                {/* --- Platform-Specific Controls --- */}
                        <div className="space-y-3">
                    {multiOutputPlatforms.map((platform) => (
                        <div key={platform.id} className="flex items-center gap-3">
                            <button
                                onClick={() => onOpenPlatformSettings(platform.id)}
                                // แก้ไขตรงนี้: เปลี่ยน text-2xl เป็น text-xl
                                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-xl" // <--- เปลี่ยนตรงนี้!
                                aria-label={`Settings for ${platform.name}`}
                            >
                                {platform.icon}
                            </button>
                            <button
                                onClick={() => onStartMultiOutput(platform.name)}
                                disabled={obsStatus !== 'connected'}
                                className={`flex-1 control-btn rounded-lg text-white px-4 py-2 h-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm ${platform.startBg}`}
                            >
                                <FaPlay className="mr-2" /> Start {platform.name}
                            </button>
                            <button
                                onClick={() => onStopMultiOutput(platform.name)}
                                disabled={obsStatus !== 'connected'}
                                className={`flex-1 control-btn rounded-lg text-white px-4 py-2 h-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm ${platform.stopBg}`}
                            >
                                <FaStop className="mr-2" /> Stop {platform.name}
                            </button>
                        </div>
                    ))}
                    {/* และตรงปุ่ม Restream.io ด้วย */}
                    <div className="flex items-center gap-3">
                         <button
                             onClick={() => onOpenPlatformSettings('restream')}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-xl"
                             aria-label="Settings for Restream.io"
                         >
                            <FaGlobe className="text-purple-500" />
                         </button>
                         <div className="flex-1 text-center text-sm text-gray-500 dark:text-gray-400">
                            ตั้งค่าเพิ่มเติมสำหรับ Restream, Custom RTMP...
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
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

const SettingsModal: FC<{
    platform: string;
    obs: OBSWebSocket;
    isConnected: boolean;
    onClose: () => void;
    onAlert: (props: { message: string, alertType: 'success' | 'error' | 'info' }) => void;
    handleConnectRestream: () => void;
}> = ({ platform, obs, isConnected, onClose, onAlert, handleConnectRestream }) => {

    const platformConfigs = {
        facebook: { name: 'Facebook Live', icon: <FaFacebookF className="text-blue-500" /> },
        youtube: { name: 'YouTube Live', icon: <FaYoutube className="text-red-500" /> },
        twitch: { name: 'Twitch Live', icon: <FaTwitch className="text-purple-500" /> },
        tiktok: { name: 'TikTok Live', icon: <FaTiktok className="text-black dark:text-white" /> },
        instagram: { name: 'Instagram Live', icon: <FaInstagram className="text-pink-500" /> },
        shopee: { name: 'Shopee Live', icon: <SiShopee className="text-orange-500" /> },
        custom: { name: 'Custom RTMP', icon: <FaSatelliteDish className="text-teal-400" /> },
        restream: { name: 'Restream.io', icon: <FaGlobe className="text-purple-500" /> }
    };
    const config = platformConfigs[platform as keyof typeof platformConfigs];

    const [url, setUrl] = useState(() => localStorage.getItem(`${platform}-url`) || (platform === 'facebook' ? 'rtmps://live-api-s.facebook.com:443/rtmp/' : ''));
    const [key, setKey] = useState(() => localStorage.getItem(`${platform}-key`) || '');
    const [videoBitrate, setVideoBitrate] = useState(() => localStorage.getItem('facebook-videoBitrate') || '6000');
    const [audioBitrate, setAudioBitrate] = useState(() => localStorage.getItem('facebook-audioBitrate') || '160');
    const [encoder, setEncoder] = useState(() => localStorage.getItem('facebook-encoder') || 'obs_x264');
    const [preset, setPreset] = useState(() => localStorage.getItem('facebook-preset') || 'veryfast');
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        setUrl(localStorage.getItem(`${platform}-url`) || (platform === 'facebook' ? 'rtmps://live-api-s.facebook.com:443/rtmp/' : ''));
        setKey(localStorage.getItem(`${platform}-key`) || '');
        if (platform === 'facebook') {
            setVideoBitrate(localStorage.getItem('facebook-videoBitrate') || '6000');
            setAudioBitrate(localStorage.getItem('facebook-audioBitrate') || '160');
            setEncoder(localStorage.getItem('facebook-encoder') || 'obs_x264');
            setPreset(localStorage.getItem('facebook-preset') || 'veryfast');
        }
    }, [platform]);


const handleSave = async () => {
    if (!isConnected) {
        return onAlert({ message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' });
    }
    if (!url || !key) {
        return onAlert({ message: 'กรุณากรอก Server URL และ Stream Key', alertType: 'error' });
    }

    localStorage.setItem(`${platform}-url`, url);
    localStorage.setItem(`${platform}-key`, key);

    try {
        // บันทึกการตั้งค่าเพิ่มเติมสำหรับ Facebook (ถ้ามี)
        if (platform === 'facebook') {
            localStorage.setItem('facebook-videoBitrate', videoBitrate);
            localStorage.setItem('facebook-audioBitrate', audioBitrate);
            localStorage.setItem('facebook-encoder', encoder);
            localStorage.setItem('facebook-preset', preset);
        }
        onAlert({ message: `บันทึกค่าสำหรับ ${platform} สำเร็จ!`, alertType: 'success' });

    } catch (error: any) {
        onAlert({ message: `บันทึกค่าสำหรับ ${platform} ล้มเหลว: ${error.message}`, alertType: 'error' });
    }
};

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg m-4">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl flex items-center gap-3">{config.icon} {config.name}</h3>
                    <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {platform === 'restream' ? (
                        <div>
                            <h3 className="font-semibold mb-3">เชื่อมต่อ Restream.io</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-4">
                                คลิกปุ่มด้านล่างเพื่อเชื่อมต่อบัญชี Restream ของคุณ
                                จะพาไปยังหน้า Login ของ Restream เพื่อให้คุณอนุมัติการเข้าถึง
                            </p>
                            <button
                                onClick={handleConnectRestream}
                                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
                            >
                                เชื่อมต่อกับ Restream
                            </button>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block mb-1 font-semibold text-sm">Server URL</label>
                                <input type="text" value={url} onChange={e => setUrl(e.target.value)} disabled={platform === 'facebook'} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600 disabled:cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block mb-1 font-semibold text-sm">คีย์สตรีม (Stream Key)</label>
                                <div className="relative">
                                    <input type={showKey ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} className="w-full p-2 pr-10 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600" />
                                    <button onClick={() => setShowKey(!showKey)} className="absolute inset-y-0 right-0 top-0 pr-3 flex items-center text-gray-400">{showKey ? <FaEyeSlash /> : <FaEye />}</button>
                                </div>
                                {platform === 'facebook' && <a href="https://www.facebook.com/live/producer?ref=OBS" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-blue-600 hover:underline"><FaKey className="mr-1 inline"/> ขอคีย์สตรีม</a>}
                            </div>
                            {platform === 'facebook' && (
                                <>
                                    <hr className="dark:border-gray-600 my-4" />
                                    <h4 className="font-semibold">การตั้งค่า Output (ไม่บังคับ)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block mb-1 font-semibold text-sm">Video Bitrate (Kbps)</label>
                                            <input type="number" value={videoBitrate} onChange={e => setVideoBitrate(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600" />
                                        </div>
                                        <div>
                                            <label className="block mb-1 font-semibold text-sm">Audio Bitrate (Kbps)</label>
                                            <input type="number" value={audioBitrate} onChange={e => setAudioBitrate(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block mb-1 font-semibold text-sm">Encoder</label>
                                        <select value={encoder} onChange={e => setEncoder(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                                            <option value="obs_x264">Software (x264)</option>
                                            <option value="nvenc_h264">Hardware (NVENC, H.264)</option>
                                            <option value="amd_amf_h264">Hardware (AMD, H.264)</option>
                                            <option value="qsv_h264">Hardware (Intel QSV, H.264)</option>
                                        </select>
                                    </div>
                                    <div>
                                         <label className="block mb-1 font-semibold text-sm">Encoder Preset</label>
                                         <select value={preset} onChange={e => setPreset(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                                             <option value="quality">เน้นคุณภาพ (Quality)</option>
                                             <option value="balanced">สมดุล (Balanced)</option>
                                             <option value="speed">เน้นความเร็ว (Speed)</option>
                                             <option value="veryfast">Very Fast (x264)</option>
                                             <option value="faster">Faster (x264)</option>
                                         </select>
                                     </div>
                                </>
                            )}
                        </>
                    )}
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold">ยกเลิก</button>
                    {platform !== 'restream' && (
                        <button onClick={handleSave} className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">ตั้งค่าเป็นปลายทาง</button>
                    )}
                </div>
            </div>
        </div>
    );
};
const AlertModal: FC<{ message: string; alertType: 'success' | 'error' | 'info'; onClose: () => void; }> = ({ message, alertType, onClose }) => {
    const icons = {
        success: <FaCircleCheck className="text-green-500" />,
        error: <FaCircleXmark className="text-red-500" />,
        info: <FaCircleInfo className="text-blue-500" />,
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm m-4 text-center shadow-2xl">
                <div className="text-5xl mb-4 flex justify-center">{icons[alertType]}</div>
                <p className="text-lg mb-6 whitespace-pre-wrap">{message}</p>
                <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white w-1/2 py-2 rounded-lg font-semibold">ตกลง</button>
            </div>
        </div>
    );
};
const ConfirmModal: FC<{ message: string; onConfirm: () => void; onClose: () => void; }> = ({ message, onConfirm, onClose }) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm m-4 text-center shadow-2xl">
            <div className="text-5xl mb-4 flex justify-center"><FaCircleQuestion className="text-yellow-500" /></div>
            <p className="text-lg mb-6">{message}</p>
            <div className="flex justify-center gap-4">
                <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white w-1/3 py-2 rounded-lg font-semibold">ยกเลิก</button>
                <button onClick={() => { onConfirm(); onClose(); }} className="bg-red-600 hover:bg-red-700 text-white w-1/3 py-2 rounded-lg font-semibold">ตกลง</button>
            </div>
        </div>
    </div>
);
const ProductModal: FC<{ product?: Product; onSave: (data: Omit<Product, 'id'>, id?: number) => void; onClose: () => void; }> = ({ product, onSave, onClose }) => {
    const [name, setName] = useState(product?.name || '');
    const [price, setPrice] = useState(product?.price || 0);
    const [category, setCategory] = useState<'general' | 'featured' | 'sale'>(product?.category || 'general');
    const [icon, setIcon] = useState(product?.icon || '🛍️');
    const isEditing = !!product;

    const productEmojis = ['🛍️', '👕', '👗', '👠', '👜', '⌚', '💄', '🎮', '📱', '💻', '🏠', '🎁'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, price, category, icon }, product?.id);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{isEditing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white text-2xl">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อสินค้า" className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg" required />
                    <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="ราคา" className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg" required min="0" />
                    <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <option value="general">ทั่วไป</option><option value="featured">แนะนำ</option><option value="sale">ลดราคา</option>
                    </select>
                    <div>
                        <label className="font-semibold mb-1 block">ไอคอนสินค้า</label>
                        <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg grid grid-cols-8 gap-1">
                            {productEmojis.map(emoji => (
                                <button key={emoji} type="button" onClick={() => setIcon(emoji)} className={`text-2xl rounded-md p-1 transition-colors hover:bg-gray-300 dark:hover:bg-gray-600 ${icon === emoji ? 'bg-blue-500' : ''}`}>{emoji}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="py-2 px-5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold">ยกเลิก</button>
                        <button type="submit" className={`py-2 px-5 rounded-lg text-white font-semibold ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>{isEditing ? 'บันทึก' : 'เพิ่ม'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default App;