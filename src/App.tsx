import React, { useState, useEffect, useRef, useCallback, FC, useReducer } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { ObsManagementPanel } from './components/ObsManagementPanel';
import {
    FaFacebookF, FaYoutube, FaTiktok, FaInstagram, FaBoxOpen, FaPlus, FaEye,
    FaPlay, FaStop, FaCheckDouble, FaComments, FaChartLine, FaGear, FaPaperPlane, FaPencil,
    FaTrash, FaSun, FaMoon, FaChevronDown, FaKey, FaSatelliteDish, FaCircleCheck, FaCircleXmark,
    FaCircleInfo, FaCircleQuestion, FaEyeSlash, FaMicrophone, FaShopware,
    FaTwitch, FaXTwitter, FaGlobe // <--- เพิ่ม Icons เหล่านี้
} from 'react-icons/fa6';
import OBSWebSocket from 'obs-websocket-js';

// ====================================================================
// Type Definitions - ย้ายไปที่ src/types.ts ทั้งหมดแล้ว
// ====================================================================
import {
    Product, Comment, OBSScene, OBSSource, OBSAudioInput, AppState, Action, RestreamChannel
} from './types'; // ✅ นำเข้าจากไฟล์ types.ts
import ChannelsTab from './components/ChannelsTab';
import { dataDir } from '@tauri-apps/api/path';
// ====================================================================
// State Management with useReducer
// ====================================================================

const initialState: AppState = {
    obsStatus: 'disconnected',
    isStreaming: false,
    streamTime: '00:00:00',
    viewerCount: 0,
    products: [],
    selectedProductId: null,
    // activePlatforms: new Set(), // ลบออก - ไม่ได้ใช้กับ Restream Channels โดยตรงแล้ว
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
            // console.log('Updating audio levels for:', action.payload.inputName, action.payload.levels); // ลด log
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
        case 'UPDATE_RESTREAM_CHANNEL_STATUS': // เพิ่ม Action ใหม่
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

// โค้ดใหม่ที่ถูกต้อง - ไม่จำเป็นต้องใช้ Destinations ตรงนี้แล้ว
// เนื่องจากเราจะจัดการ channels ผ่าน Restream API โดยตรง
// type Destination = {
//   enabled: boolean;
// };

// type Destinations = {
//   [platform: string]: Destination;
// };
// ====================================================================
// Main App Component
// ====================================================================
const App: FC = () => {

    const obs = useRef(new OBSWebSocket());
    const videoRef = useRef<HTMLVideoElement>(null); // ✅ ตรวจสอบให้แน่ใจว่าเป็น HTMLVideoElement
    const streamTimerRef = useRef<number | null>(null);
    const productOverlayTimerRef = useRef<number | null>(null);

    const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('theme-dark', false);
    const [appState, dispatch] = useReducer(appReducer, initialState);
    const [modal, setModal] = useState<{ type: 'alert' | 'confirm' | 'product' | 'settings' | null; props?: any }>({ type: null });
    // เพิ่ม state ใหม่สำหรับ Scene Modal
    const [sceneModal, setSceneModal] = useState<{ type: 'add' | null; props?: any }>({ type: null });

        // --- เพิ่ม state สำหรับ Restream Access Token ---
        const [restreamAccessToken, setRestreamAccessToken] = useState<string | null>(() => {
        return localStorage.getItem('restream-access-token');
        });
    // -----------------------------------------------

    // ลบ destinations state ออกไป เพราะเราจะจัดการ channels ผ่าน restream API
    // const [destinations, setDestinations] = useLocalStorage<Destinations>('destinations', {
    // Facebook: { enabled: false },
    // YouTube: { enabled: false },
    // TikTok: { enabled: false },
    // Instagram: { enabled: false },
    // Shopee: { enabled: false },
    // });

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
                    console.log("Using OBS Virtual Camera:", obsVirtualCamera.label);
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
        // เรียกใช้ setupCamera
        setupCamera();
        // Dependency array: videoRef และ setModal ถูกใช้ภายใน useCallback
        // เนื่องจาก setupCamera ถูกประกาศภายใน useEffect และใช้ค่าจาก scope ของ App component
        // จึงไม่จำเป็นต้องใส่ใน dependency array แต่ถ้าคุณประกาศ setupCamera เป็น useCallback
        // และใช้ค่าจากภายนอก ก็ต้องใส่ใน dependency array ของ useCallback นั้นๆ
        // ในกรณีนี้ ปล่อยให้ dependency array เป็น [] ก็เพียงพอเพราะ setModal และ videoRef ไม่ได้เปลี่ยนค่า
    }, []);


const fetchOBSData = useCallback(async () => {
    // console.log('[DEBUG] fetchOBSData called.'); // ลด log
    if (!obs.current.identified) {
        // console.warn('[DEBUG] OBS is not identified yet. Skipping data fetch.'); // ลด log
        return;
    }

    // console.log('[DEBUG] Attempting to fetch OBS data...'); // ลด log
    try {
        const [sceneListData, currentSceneData, allInputListData] = await Promise.all([
            obs.current.call('GetSceneList'),
            obs.current.call('GetCurrentProgramScene'),
            obs.current.call('GetInputList'),
        ]);

        // console.log('[DEBUG] Raw ALL Input List:', allInputListData.inputs); // ลด log

        // **ส่วนที่เพิ่มเข้าไปเพื่อดู inputKind ของแต่ละ input**
        // allInputListData.inputs.forEach((input: any) => { // ลด log
        //     console.log(`[DEBUG] Input Name: ${input.inputName}, Kind: ${input.inputKind}`); // ลด log
        // });

        const currentSceneName = currentSceneData.currentProgramSceneName;
        // console.log('[DEBUG] Current Scene Name:', currentSceneName); // ลด log

        if (!currentSceneName) {
            console.warn('[DEBUG] No current program scene found. Exiting fetchOBSData.');
            return;
        }

        const sourceListData = await obs.current.call('GetSceneItemList', { sceneName: currentSceneName });
        // console.log('✅ SUCCESS: Sources for current scene:', sourceListData.sceneItems); // ลด log

        const sources: OBSSource[] = sourceListData.sceneItems.map((item: any) => ({
            sceneItemId: Number(item.sceneItemId),
            sourceName: String(item.sourceName),
            sceneItemEnabled: Boolean(item.sceneItemEnabled)
        }));

        // กรองเฉพาะ Audio Inputs จาก allInputListData.inputs
        const audioInputsRaw: Omit<OBSAudioInput, 'inputLevels'>[] = await Promise.all(
            allInputListData.inputs
                .filter((input: any) =>
                    input.inputKind.includes('wasapi') ||
                    input.inputKind.includes('coreaudio') ||
                    input.inputKind.includes('pulse') || // สำหรับ Linux
                    input.inputKind.includes('mic') // เผื่อมีบาง inputKind ใช้คำนี้
                )
                .map(async (input: any) => {
                    try {
                        const { inputMuted } = await obs.current.call('GetInputMute', { inputName: input.inputName });
                        const { inputVolumeDb } = await obs.current.call('GetInputVolume', { inputName: input.inputName });

                        return {
                            inputName: String(input.inputName),
                            inputMuted: Boolean(inputMuted),
                            inputVolumeDb: Number(inputVolumeDb) || -100, // ค่าเริ่มต้น -100 สำหรับไม่พบ volume
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

        // console.log('[DEBUG] Processed Audio Inputs (without levels):', audioInputsRaw); // ลด log

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
            // ไม่ต้องแจ้งเตือนตรงนี้ เพราะ Identified จะแจ้งเอง
        };

        const onIdentified = async () => {
            console.log('[DEBUG] OBS identified successfully!');
            dispatch({ type: 'SET_OBS_STATUS', payload: 'connected' });
            setModal({ type: 'alert', props: { message: 'เชื่อมต่อและยืนยันตัวตนกับ OBS สำเร็จ!', alertType: 'success' } });

            // ขอ Input Volume Meters สำหรับ audio inputs ทั้งหมดที่ fetch มาได้

            await fetchOBSData(); // เรียก fetchOBSData หลังจาก Identified แล้ว
        };

        const onConnectionClosed = () => {
            dispatch({ type: 'SET_OBS_STATUS', payload: 'disconnected' });
            dispatch({ type: 'SET_STREAM_STATE', payload: false });
            dispatch({ type: 'RESET_OBS_DATA' });
            stopStreamTimer();
            setModal({ type: 'alert', props: { message: 'ตัดการเชื่อมต่อจาก OBS แล้ว', alertType: 'info' } });
        };

        const onCurrentProgramSceneChanged = () => {
            fetchOBSData(); // เรียกเมื่อ Scene เปลี่ยน
        };
        const onSceneListChanged = () => { // เพิ่ม listener สำหรับ SceneListChanged
            fetchOBSData(); // เรียกเมื่อ Scene List เปลี่ยน (เช่น เพิ่ม/ลบ Scene)
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
            // console.log('Input Volume Meters Event:', data); // ลด log
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
        obsInstance.on('SceneListChanged', onSceneListChanged); // เพิ่ม
        obsInstance.on('InputCreated', onInputCreated); // เพิ่ม
        obsInstance.on('InputRemoved', onInputRemoved); // เพิ่ม
        obsInstance.on('InputNameChanged', onInputNameChanged); // เพิ่ม
        obsInstance.on('SceneItemEnableStateChanged', onSceneItemEnableStateChanged);
        obsInstance.on('InputMuteStateChanged', onInputMuteStateChanged);
        obsInstance.on('InputVolumeMeters', onInputVolumeMeters);

        return () => {
            obsInstance.off('StreamStateChanged', onStreamStateChanged);
            obsInstance.off('ConnectionOpened', onConnectionOpened);
            obsInstance.off('Identified', onIdentified);
            obsInstance.off('ConnectionClosed', onConnectionClosed);
            obsInstance.off('CurrentProgramSceneChanged', onCurrentProgramSceneChanged);
            obsInstance.off('SceneListChanged', onSceneListChanged); // ลบ
            obsInstance.off('InputCreated', onInputCreated); // ลบ
            obsInstance.off('InputRemoved', onInputRemoved); // ลบ
            obsInstance.off('InputNameChanged', onInputNameChanged); // ลบ
            obsInstance.off('SceneItemEnableStateChanged', onSceneItemEnableStateChanged);
            obsInstance.off('InputMuteStateChanged', onInputMuteStateChanged);
            obsInstance.off('InputVolumeMeters', onInputVolumeMeters);
            if(obsInstance.identified) obsInstance.disconnect();
        };
    }, [fetchOBSData, dispatch, setModal]); // เพิ่ม appState.audioInputs เข้าไปใน dependency เพื่อให้ SetInputVolumeMeters ทำงานถูกต้อง

// --- Effect สำหรับจัดการ Restream OAuth Callback ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth_status');
        const message = urlParams.get('message');
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token'); // <--- ตัวแปรนี้

        if (authStatus) {
            if (authStatus === 'success' && accessToken) {
                        setRestreamAccessToken(accessToken);
                        // **เพิ่มบรรทัดนี้เพื่อเก็บ refreshToken ถ้ามี**
                        if (refreshToken) {
                            localStorage.setItem('restream-refresh-token', refreshToken);
                        }
                        setModal({ type: 'alert', props: { message: 'เชื่อมต่อ Restream สำเร็จ!', alertType: 'success' } });
                    } else if (authStatus === 'failed') {
                        setModal({ type: 'alert', props: { message: `เชื่อมต่อ Restream ล้มเหลว: ${decodeURIComponent(message || 'ไม่ทราบสาเหตุ')}`, alertType: 'error' } });
                    }
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [setRestreamAccessToken, setModal]);

// ใน App.tsx (ใน App component)
const fetchRestreamChannels = useCallback(async () => {
        try {
            const currentAccessToken = localStorage.getItem('restream-access-token');
            console.log('Current Access Token:', currentAccessToken);
          if (!currentAccessToken) {
            // ถ้าไม่มี token ใน localStorage ให้เคลียร์ channels และ return
            dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: [] });
            return;
        }

            console.log('Fetching Restream channels with token. Length:', currentAccessToken.length);
            const response = await fetch('http://localhost:5000/api/restream-channels', {
                headers: {
                    'Authorization': `Bearer ${currentAccessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Back-End API response not OK:", response.status, errorData);
                if (response.status === 401) {
                    setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                    localStorage.removeItem('restream-access-token');
                    setRestreamAccessToken(null); // ทำให้ state ใน App component อัปเดตด้วย
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('--- Data from Back-End (in App.tsx) ---', data);

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
            // ไม่ต้อง dispatch SET_RESTREAM_CHANNELS here, let the main useEffect handle it
            // if (error instanceof Error && error.message.includes('401')) {
            //     // Already handled above
            // } else {
            //     setModal({ type: 'alert', props: { message: 'ไม่สามารถดึงข้อมูลช่อง Restream ได้', alertType: 'error' } });
            // }
        }
}, [dispatch, setRestreamAccessToken]);

// ใน App.tsx (ใน App component)
useEffect(() => {
    let intervalId: number | undefined; // ใช้ undefined แทน null เพื่อความชัดเจน

    // สร้างฟังก์ชันภายใน useEffect เพื่อลด dependencies ของ useCallback
    // หรือคง useCallback ไว้ตามเดิม แต่ต้องแน่ใจว่ามันไม่ทำให้เกิด loop
    const initiateFetchAndInterval = async () => {
        if (!restreamAccessToken) {
            console.log('No Restream Access Token available. Clearing channels and skipping fetch/interval.');
            dispatch({ type: 'SET_RESTREAM_CHANNELS', payload: [] });
            return;
        }

        console.log('Restream Access Token exists. Starting channel fetch and interval.');
        // เรียก fetch ทันที
        await fetchRestreamChannels();

        // ตั้ง interval
        intervalId = window.setInterval(fetchRestreamChannels, 30000);
    };

    initiateFetchAndInterval(); // เรียกใช้ฟังก์ชันนี้ทันทีที่ effect ทำงาน

    // Cleanup function
    return () => {
        if (intervalId) {
            window.clearInterval(intervalId);
        }
        console.log('Restream channels useEffect cleanup.');
    };
    // Dependencies ที่ควรมี: restreamAccessToken และ fetchRestreamChannels
    // dispatch ไม่จำเป็นต้องอยู่ในนี้ถ้ามันไม่ได้ถูกใช้ใน initiateFetchAndInterval โดยตรง
    // แต่ถ้า dispatch ถูกใช้ใน fetchRestreamChannels (ซึ่งถูกใช้), ก็ควรอยู่ใน dependency ของ fetchRestreamChannels
    // และถ้า fetchRestreamChannels ถูกสร้างด้วย useCallback โดยมี dispatch ใน dependency ของมัน
    // มันก็จะไม่ re-create บ่อยๆ และจะทำงานถูกต้อง
}, [restreamAccessToken, fetchRestreamChannels, dispatch]); // คง dispatch ไว้เพื่อความปลอดภัย


    useEffect(() => {
        if (restreamAccessToken) {
            localStorage.setItem('restream-access-token', restreamAccessToken);
        } else {
            localStorage.removeItem('restream-access-token');
        }
    }, [restreamAccessToken]);

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

    // --- Handlers ---
    const handleConnectOBS = useCallback(async (ip: string, port: string, password: string, savePassword: boolean) => {
        dispatch({ type: 'SET_OBS_STATUS', payload: 'connecting' });
        try {
            await obs.current.connect(`ws://${ip}:${port}`, password, {
                eventSubscriptions:
                    (1 << 0) | // General (e.g., Identified, ExitStarted)
                    (1 << 1) | // Config (e.g., CurrentProfileChanged) - ไม่จำเป็นต้องใช้
                    (1 << 2) | // Scenes (CurrentProgramSceneChanged, SceneListChanged)
                    (1 << 3) | // Inputs (InputCreated, InputRemoved, InputMuteStateChanged)
                    (1 << 5) | // Inputs (InputMuteStateChanged, InputVolumeMeters) // ตรงนี้ซ้ำกับ 1<<3
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
            // อาจจะไม่มี error ตรงนี้ แต่ถ้ามีก็ควรแจ้ง
        }
    }, []);

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
            console.log("🚀 Attempting to start the main stream to Restream.io...");
            await obs.current.call('StartStream');

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
        try {
            await obs.current.call('StopStream');
        } catch (error: any) {
            setModal({ type: 'alert', props: { message: error.message, alertType: 'error' } });
        }
    }, [setModal]);

    const handleGetOutputList = useCallback(async () => {
        if (appState.obsStatus !== 'connected') {
            console.log('OBS is not connected.');
            setModal({ type: 'alert', props: { message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'info' } });
            return;
        }
        try {
            const data = await obs.current.call('GetOutputList');
            console.log('--- AVAILABLE OBS OUTPUTS ---');
            console.log(data.outputs);
            setModal({ type: 'alert', props: { message: 'ตรวจสอบ Console (F12) เพื่อดูรายชื่อ Output ทั้งหมด', alertType: 'info' } });
        } catch (e) {
            console.error('Failed to get output list:', e);
            setModal({ type: 'alert', props: { message: 'ไม่สามารถดึงข้อมูล Output ได้ เกิดข้อผิดพลาด', alertType: 'error' } });
        }
    }, [appState.obsStatus, obs, setModal]);

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

       // เพิ่มฟังก์ชันใหม่สำหรับการ Toggle สถานะของ Restream Channel
        const handleToggleRestreamChannel = useCallback(async (channelId: number, currentEnabledState: boolean) => {
            const currentAccessToken = localStorage.getItem('restream-access-token');
            if (!currentAccessToken) {
                setModal({ type: 'alert', props: { message: 'ไม่มี Token สำหรับ Restream.io กรุณาเชื่อมต่อบัญชีใหม่', alertType: 'error' } });
                return;
                }
            // *** เพิ่มการแปลงค่าให้เป็น boolean ชัดเจนก่อนส่ง ***
                const newEnabledState = Boolean(!currentEnabledState); // ยืนยันว่าเป็น boolean

            try {
                const response = await fetch(`http://localhost:5000/api/restream-channels/${channelId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentAccessToken}`
                    },
                    body: JSON.stringify({ enabled: newEnabledState }) // สลับสถานะ
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 401) {
                         setModal({ type: 'alert', props: { message: 'Session หมดอายุ กรุณาเชื่อมต่อ Restream ใหม่', alertType: 'error' } });
                         localStorage.removeItem('restream-access-token');
                         setRestreamAccessToken(null);
                    }
                    throw new Error(`Failed to update channel status: ${errorData.message || response.statusText}`);
                }

                const updatedChannel = await response.json();
                ///console.log('Channel updated:', data.channel);
                // อัปเดต state ใน App component ทันที
                dispatch({
                    type: 'UPDATE_RESTREAM_CHANNEL_STATUS',
                    payload: { channelId: channelId, enabled: updatedChannel.enabled }
                });
                setModal({ type: 'alert', props: { message: `เปิดการถ่ายทอดสด สำเร็จ!`, alertType: 'success' } });

            } catch (error) {
                console.error('Error toggling Restream channel status:', error);
                setModal({ type: 'alert', props: { message: `ไม่สามารถอัปเดตสถานะช่องได้: ${(error as Error).message}`, alertType: 'error' } });
            }
        }, [setModal, setRestreamAccessToken, dispatch]);

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
            setSceneModal({ type: null }); // ปิด modal
            // OBS จะส่ง SceneListChanged event ซึ่งจะเรียก fetchOBSData() ให้อัปเดต UI เอง
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
                        // OBS จะส่ง SceneListChanged event ซึ่งจะเรียก fetchOBSData() ให้อัปเดต UI เอง
                    } catch (e: any) {
                        console.error('Failed to remove scene:', e);
                        setModal({ type: 'alert', props: { message: `ไม่สามารถลบ Scene ได้: ${e.message || 'เกิดข้อผิดพลาด'}`, alertType: 'error' } });
                    }
                }
            }
        });
    }, [setModal]);

    const obsStatusMap = {
        connected: { text: 'Connected', iconColor: 'bg-green-500' },
        connecting: { text: 'Connecting', iconColor: 'bg-yellow-500 animate-pulse' },
        failed: { text: 'Failed', iconColor: 'bg-red-500' },
        disconnected: { text: 'Disconnected', iconColor: 'bg-gray-400' }
    };
    const currentObsStatus = obsStatusMap[appState.obsStatus];
    // console.log('appState.restreamChannels in App.tsx before sending to RightPanel:', appState.restreamChannels); // ลด log

    return (
        <div className={`bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 min-h-screen font-sans`}>
            <div className="container mx-auto p-4 lg:p-6 flex flex-col h-screen">
                <header className="text-center mb-6 relative">
                    <div className="flex items-center justify-center gap-x-4">
                        <h1 className="text-3xl lg:text-xl font-bold text-gray-900 dark:text-white">🔴 Multi-Platform Live Streaming</h1>
                        <div onClick={() => dispatch({ type: 'SET_STATE', payload: { activeRightTab: 'settings' } })} className="flex items-center justify-center gap-2 text-xl font-semibold px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 cursor-pointer">
                            <span className={`w-3 h-3 rounded-lg ${currentObsStatus.iconColor}`}></span>
                            <span>{currentObsStatus.text}</span>
                        </div>
                    </div>
                    <button onClick={() => setIsDarkMode(prev => !prev)} className="absolute top-0 right-0 p-3 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                        {isDarkMode ? <FaSun className="text-xl" /> : <FaMoon className="text-xl" />}
                    </button>
                </header>

                <main className="flex-grow grid grid-cols-12 grid-rows-[1fr_auto] gap-6 min-h-0">

                    <div className="col-span-12 row-span-1 grid grid-cols-12 gap-6 min-h-0">
                        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
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

                        <div className="lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                           <StreamPanel
                                isStreaming={appState.isStreaming}
                                streamTime={appState.streamTime}
                                runningText={appState.runningText}
                                overlayProduct={appState.overlayProduct}
                                videoRef={videoRef}
                                onStartStream={handleStartStream}
                                onStopStream={handleStopStream}
                                onCheckSettings={handleCheckStreamSettings}
                                isObsConnected={appState.obsStatus === 'connected'}
                                // destinations={destinations} // ลบออก
                                handleGetOutputList={handleGetOutputList}
                            />
                        </div>

                        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col shadow-lg overflow-hidden">
                           <RightPanel
                                activeTab={appState.activeRightTab}
                                setActiveTab={(tab) => dispatch({ type: 'SET_STATE', payload: { activeRightTab: tab } })}
                                obsStatus={appState.obsStatus}
                                analytics={appState.analytics}
                                runningText={appState.runningText}
                                streamTitle={appState.streamTitle}
                                onConnectOBS={handleConnectOBS}
                                onDisconnectOBS={handleDisconnectOBS}
                                onSendComment={handleSendComment}
                                onUpdateRunningText={(text) => dispatch({ type: 'SET_STATE', payload: { runningText: text } })}
                                onUpdateStreamTitle={(title) => dispatch({ type: 'SET_STATE', payload: { streamTitle: title } })}
                                onOpenPlatformSettings={(platform) => setModal({type: 'settings', props: { platform }})}
                                onSetModal={setModal}
                                restreamChannels={appState.restreamChannels}
                                onFetchRestreamChannels={fetchRestreamChannels}
                                onToggleRestreamChannel={handleToggleRestreamChannel} // ส่งฟังก์ชันนี้ไป
                            />
                        </div>
                    </div>

                    <div className="col-span-12">
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
            </div>

            {modal.type === 'alert' && <AlertModal {...modal.props} onClose={() => setModal({ type: null })} />}
            {modal.type === 'confirm' && <ConfirmModal {...modal.props} onClose={() => setModal({ type: null })} />}
            {modal.type === 'product' && <ProductModal {...modal.props} onClose={() => setModal({ type: null })} />}
            {modal.type === 'settings' && <SettingsModal {...modal.props} obs={obs.current} isConnected={appState.obsStatus === 'connected'} onClose={() => setModal({ type: null })} onAlert={(props) => setModal({type: 'alert', props})} />}
            {sceneModal.type === 'add' && <AddSceneModal onAdd={handleAddScene} onClose={() => setSceneModal({ type: null })} />}

        </div>
    );
};

// ====================================================================
// UI Components
// ====================================================================

// เพิ่ม Component ใหม่สำหรับ Add Scene Modal
const AddSceneModal: FC<{ onAdd: (sceneName: string) => void; onClose: () => void; }> = ({ onAdd, onClose }) => {
    const [sceneName, setSceneName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sceneName.trim()) {
            onAdd(sceneName.trim());
        } else {
            alert('กรุณากรอกชื่อ Scene'); // สามารถเปลี่ยนเป็น setModal alert ได้
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
    runningText: string;
    overlayProduct: Product | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    onStartStream: () => void;
    onStopStream: () => void;
    onCheckSettings: () => void;
    isObsConnected: boolean;
    // destinations: Destinations; // ลบออก
    handleGetOutputList: () => void;
}> = (props) => {
    const {
        isStreaming,
        streamTime,
        runningText,
        overlayProduct,
        videoRef,
        onStartStream,
        onStopStream,
        onCheckSettings,
        isObsConnected,
        // destinations, // ลบออก
        handleGetOutputList
    } = props;

    // ลบ platforms และ onToggleDestination ออกไป เพราะไม่ได้ควบคุมจากหน้านี้แล้ว

    return (
        <>
            {/* ลบส่วน Platform Selection (Grid) ออกไป */}
            {/* <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                {platforms.map(p => (
                    <button
                        key={p.id}
                        onClick={() => onToggleDestination(p.id)}
                        className={`platform-btn p-2 text-sm rounded-lg font-semibold transition-all duration-300 flex items-center justify-center ${
                            destinations[p.id]?.enabled
                                ? p.color + ' text-white'
                                : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    >
                        {p.icon}<span className="hidden sm:inline-block md:inline ml-1 text-xs">{p.name}</span>
                    </button>
                ))}
            </div> */}
            <div className="flex-grow bg-black rounded-lg relative overflow-hidden min-h-0">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline></video>
                <div className={`absolute top-3 left-3 px-3 py-1 text-sm font-bold text-white rounded-full transition-all ${isStreaming ? 'bg-red-600 pulse-live-animation' : 'bg-gray-500'}`}>
                    {isStreaming ? 'LIVE' : 'OFFLINE'}
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1 text-sm font-bold text-white rounded bg-black/50">{streamTime}</div>
                {overlayProduct && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white p-3 rounded-lg text-center animate-fade-in">
                        <div className="font-bold">{overlayProduct.name}</div>
                        <div className="text-lg text-yellow-400 font-bold">฿{overlayProduct.price.toLocaleString()}</div>
                    </div>
                )}
                <div className="absolute bottom-12 w-full bg-black/60 overflow-hidden whitespace-nowrap">
                    {<div className="inline-block py-2 text-white font-semibold animate-scroll-left">{runningText}</div>}
                </div>
            </div>
            <div className="mt-auto pt-4 grid grid-cols-3 gap-3">
                <button onClick={onStartStream} disabled={!isObsConnected || isStreaming} className="control-btn bg-green-600 hover:bg-green-700 rounded-lg text-white  px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaPlay className="mr-2" />เริ่มไลฟ์</button>
                <button onClick={onStopStream} disabled={!isObsConnected || !isStreaming} className="control-btn bg-red-600 hover:bg-red-700 rounded-lg text-white  px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaStop className="mr-2" />หยุดไลฟ์</button>
                <button onClick={onCheckSettings} disabled={!isObsConnected} className="control-btn bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white  px-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><FaCheckDouble className="mr-2" />ตรวจสอบค่า</button>
                {/* <button onClick={handleGetOutputList} className="bg-purple-600 ...">Test: Get Output List</button> */} {/* คอมเมนต์ปุ่มนี้ไว้เพื่อไม่ให้รบกวน UI หลัก */}
            </div>
        </>
    );

};

const RightPanel: FC<{
    activeTab: AppState['activeRightTab'];
    setActiveTab: (tab: AppState['activeRightTab']) => void;
    obsStatus: AppState['obsStatus'];
    onSendComment: (text: string) => void;
    analytics: AppState['analytics'];
    restreamChannels: RestreamChannel[];
    runningText: string;
    streamTitle: string;
    onConnectOBS: (ip: string, port: string, pass: string, save: boolean) => void;
    onDisconnectOBS: () => void;
    onUpdateRunningText: (text: string) => void;
    onUpdateStreamTitle: (title: string) => void;
    onOpenPlatformSettings: (platform: string) => void;
    onSetModal: React.Dispatch<React.SetStateAction<{ type: 'alert' | 'confirm' | 'product' | 'settings' | null; props?: any }>>;
    onFetchRestreamChannels: () => void;
    onToggleRestreamChannel: (channelId: number, currentEnabledState: boolean) => void; // เพิ่ม prop นี้
}> = (props) => {
    const { activeTab, setActiveTab, onSetModal, onSendComment, restreamChannels, onFetchRestreamChannels, onToggleRestreamChannel } = props;
    // console.log('restreamChannels received in RightPanel:', restreamChannels); // ลด log
    const tabs = [
        { id: 'comments', name: 'คอมเมนต์', icon: <FaComments /> },
        { id: 'channels', name: 'ช่องสตรีม', icon: <FaGlobe /> }, // เปลี่ยน icon และชื่อให้เหมาะสมกับ "ช่องสตรีม"
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
                {activeTab === 'comments' && <CommentsTab onSendComment={onSendComment} />}
                {activeTab === 'channels' && (
                <ChannelsTab
                    restreamChannels={restreamChannels}
                    onFetchRestreamChannels={onFetchRestreamChannels}
                    onToggleChannelEnabled={onToggleRestreamChannel} // ส่งฟังก์ชันไป
                />
            )}
                {activeTab === 'settings' && <SettingsTab {...props} onSetModal={onSetModal} />}
            </div>
        </div>
    );
};

const CommentsTab: FC<{ onSendComment: (text: string) => void }> = ({ onSendComment }) => { // ต้องรับ props onSendComment
    // ใช้ embed URL จาก Restream.io สำหรับ Live Chat
    // คุณต้องเข้าไปตั้งค่าใน Restream.io Dashboard ของคุณเพื่อดึง Embed URL สำหรับแชทของคุณเอง
    // ตัวอย่าง: https://restream.io/chat-embed/
    // หากไม่มี token หรือไม่ต้องการใช้ embed สามารถเปลี่ยนมาใช้ component แสดงคอมเมนต์ปกติได้
    const restreamChatEmbedUrl = "https://chat.restream.io/embed?token=1ea9fb4c-afd3-4761-b29e-2c5dfeb76e22"; // <<--- เปลี่ยนเป็น Token ของคุณ
    const [commentInput, setCommentInput] = useState(''); // เพิ่ม state สำหรับ input

    const handleSend = () => {
        if (commentInput.trim()) {
            onSendComment(commentInput.trim());
            setCommentInput(''); // ล้าง input หลังจากส่ง
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { // กด Enter เพื่อส่ง (Shift + Enter สำหรับขึ้นบรรทัดใหม่ถ้าใช้ textarea)
            e.preventDefault(); // ป้องกันการขึ้นบรรทัดใหม่
            handleSend();
        }
    };

    return (
        <div className="h-full w-full flex flex-col"> {/* เปลี่ยนเป็น flex-col เพื่อจัด layout */}
            <div className="flex-grow"> {/* ส่วนของ iframe ให้เต็มพื้นที่ที่เหลือ */}
                <iframe
                    src={restreamChatEmbedUrl}
                    frameBorder="0"
                    className="w-full h-full"
                    title="Restream Embedded Chat"
                ></iframe>
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

// AnalyticsTab ถูกลบออกไปจาก RightPanel เพราะเรามี ChannelsTab แทนที่แล้ว
// const AnalyticsTab: FC<{analytics: AppState['analytics']}> = ({analytics}) => (
//     <div className="h-full overflow-y-auto pr-2 space-y-4 custom-scrollbar">
//         <div className="p-4 rounded-lg text-white text-center bg-gradient-to-br from-blue-500 to-indigo-600">
//             <div>ผู้ชมรวม</div><div className="text-3xl font-bold">{analytics.totalViewers}</div>
//         </div>
//         <div className="p-4 rounded-lg text-white text-center bg-gradient-to-br from-green-500 to-teal-600">
//             <div>ผู้ชมสูงสุด</div><div className="text-3xl font-bold">{analytics.peakViewers}</div>
//         </div>
//         <div className="p-4 rounded-lg text-white text-center bg-gradient-to-br from-purple-500 to-pink-600">
//             <div>คอมเมนต์ทั้งหมด</div><div className="text-3xl font-bold">{analytics.totalComments}</div>
//         </div>
//     </div>
// );

const SettingsTab: FC<Omit<Parameters<typeof RightPanel>[0], 'comments' | 'analytics' | 'activeTab' | 'setActiveTab' | 'onSendComment' | 'restreamChannels' | 'onFetchRestreamChannels' | 'onToggleRestreamChannel'>> = (props) => {
    const { obsStatus, runningText, streamTitle, onConnectOBS, onDisconnectOBS, onUpdateRunningText, onUpdateStreamTitle, onOpenPlatformSettings, onSetModal } = props;
    const [localRunningText, setLocalRunningText] = useState(runningText);

        // --- เพิ่มฟังก์ชันสำหรับเชื่อมต่อ Restream ---
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
        { id: 'facebook', icon: <FaFacebookF className="text-blue-500" /> },
        { id: 'youtube', icon: <FaYoutube className="text-red-500" /> },
        { id: 'tiktok', icon: <FaTiktok className="text-black dark:text-white" /> },
        { id: 'instagram', icon: <FaInstagram className="text-pink-500" /> },
        { id: 'shopee', icon: <FaShopware className="text-orange-500" /> },
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

// ====================================================================
// Modal Components
// ====================================================================

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

const SettingsModal: FC<{
    platform: string;
    obs: OBSWebSocket;
    isConnected: boolean;
    onClose: () => void;
    onAlert: (props: { message: string, alertType: 'success' | 'error' | 'info' }) => void;
}> = ({ platform, obs, isConnected, onClose, onAlert }) => {
    const [url, setUrl] = useState(() => localStorage.getItem(`${platform}-url`) || (platform === 'facebook' ? 'rtmps://live-api-s.facebook.com:443/rtmp/' : ''));
    const [key, setKey] = useState(() => localStorage.getItem(`${platform}-key`) || '');
    // Facebook specific state
    const [videoBitrate, setVideoBitrate] = useState(() => localStorage.getItem('facebook-videoBitrate') || '6000');
    const [audioBitrate, setAudioBitrate] = useState(() => localStorage.getItem('facebook-audioBitrate') || '160');
    const [encoder, setEncoder] = useState(() => localStorage.getItem('facebook-encoder') || 'obs_x264'); // Default เป็น obs_x264 เพื่อความเข้ากันได้
    const [preset, setPreset] = useState(() => localStorage.getItem('facebook-preset') || 'veryfast'); // Default เป็น veryfast สำหรับ x264
    const [showKey, setShowKey] = useState(false);

    // Effect เพื่อโหลดค่า settings เฉพาะเมื่อ platform เปลี่ยน
    useEffect(() => {
        setUrl(localStorage.getItem(`${platform}-url`) || (platform === 'facebook' ? 'rtmps://live-api-s.facebook.com:443/rtmp/' : ''));
        setKey(localStorage.getItem(`${platform}-key`) || '');
        // โหลดค่าเฉพาะ Facebook settings
        if (platform === 'facebook') {
            setVideoBitrate(localStorage.getItem('facebook-videoBitrate') || '6000');
            setAudioBitrate(localStorage.getItem('facebook-audioBitrate') || '160');
            setEncoder(localStorage.getItem('facebook-encoder') || 'obs_x264');
            setPreset(localStorage.getItem('facebook-preset') || 'veryfast');
        }
    }, [platform]);


    const handleSave = async () => {
        if (!isConnected) return onAlert({ message: 'ยังไม่ได้เชื่อมต่อกับ OBS!', alertType: 'error' });
        if (!url || !key) return onAlert({ message: 'กรุณากรอก Server URL และ Stream Key', alertType: 'error' });

        try {
            // ตั้งค่า Stream Service ใน OBS
            await obs.call('SetStreamServiceSettings', {
                streamServiceType: 'rtmp_custom',
                streamServiceSettings: { server: url, key }
            });
            localStorage.setItem(`${platform}-url`, url);
            localStorage.setItem(`${platform}-key`, key);

            if (platform === 'facebook') {
                const { outputs } = await obs.call('GetOutputList');
                const streamOutput = outputs.find((o: any) => o.outputFlags && o.outputFlags.OBS_OUTPUT_VIDEO && o.outputKind === 'rtmp_output'); // ต้องแน่ใจว่าเป็น rtmp_output
                if (streamOutput) {
                    // ดึง encoder settings ปัจจุบันเพื่อ merge
                    const { outputSettings: currentOutputSettings } = await obs.call('GetOutputSettings', { outputName: (streamOutput.outputName as string) });

                    const newVideoBitrate = parseInt(videoBitrate);
                    const newAudioBitrate = parseInt(audioBitrate);

                    const newSettings = {
                        ...(currentOutputSettings as object), // ใช้ settings ที่มีอยู่เดิม
                        // General Encoder Settings
                        // Bitrate ของวิดีโอ (สำหรับ Encoder Video Bitrate)
                        // Note: OBS Websocket 5 does not have direct 'video_bitrate' on 'SetOutputSettings'
                        // Bitrate for the RTMP Output is usually set within encoder settings or as 'videoBitrate' on the stream output
                        // For simplicity, we'll try to set it, but OBS might ignore if it expects it in encoder_settings
                        // A safer approach might be GetStreamServiceSettings and inferring.
                        // For proper control, you might need to adjust OBS's Encoder settings directly.
                        // Here, we're assuming 'bitrate' might apply if the output kind supports it directly.
                        // The actual video bitrate is usually set via 'SetVideoSettings' or 'SetStreamOutputSettings'
                        // 'bitrate' for RTMP output is typically the overall stream bitrate, not just video.
                        // Let's assume for this example, 'bitrate' parameter affects the video bitrate for simplicity in this context.
                        // Or, we might need to change encoder settings.
                        bitrate: newVideoBitrate, // This is a bit ambiguous for OBSWS, often affects overall stream.
                        audioBitrate: newAudioBitrate, // This is also ambiguous.

                        // Encoder specific settings
                        // OBS Studio 28+ uses a more structured 'encoderSettings' object
                        encoderSettings: {
                            ...(currentOutputSettings?.encoderSettings as object), // Merge existing encoder settings
                            // Example for x264/NVENC presets
                            preset: preset,
                            // Add other encoder specific settings here if needed
                            // 'keyint_min': 2, 'refs': 4, etc.
                        },
                        encoder: encoder, // Change encoder
                    };

                    console.log('Attempting to set output settings with:', newSettings);

                    await obs.call('SetOutputSettings', { outputName: streamOutput.outputName as string, outputSettings: newSettings });

                    localStorage.setItem('facebook-videoBitrate', videoBitrate);
                    localStorage.setItem('facebook-audioBitrate', audioBitrate);
                    localStorage.setItem('facebook-encoder', encoder);
                    localStorage.setItem('facebook-preset', preset);
                } else {
                    onAlert({ message: `ไม่พบ Stream Output ชนิด RTMP ใน OBS!`, alertType: 'error' });
                    return;
                }
            }

            onAlert({ message: `ตั้งค่าปลายทางเป็น ${config.name} สำเร็จ!`, alertType: 'success' });
            onClose(); // ปิด modal หลังจากบันทึกสำเร็จ

        } catch (error: any) {
            console.error("Save Settings Error:", error);
            onAlert({ message: 'เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกได้'), alertType: 'error' });
        }
    };


    const platformConfigs = {
        facebook: { name: 'Facebook Live', icon: <FaFacebookF className="text-blue-500" /> },
        youtube: { name: 'YouTube Live', icon: <FaYoutube className="text-red-500" /> },
        tiktok: { name: 'TikTok Live', icon: <FaTiktok className="text-black dark:text-white" /> },
        instagram: { name: 'Instagram Live', icon: <FaInstagram className="text-pink-500" /> },
        shopee: { name: 'Shopee Live', icon: <FaShopware className="text-orange-500" /> },
        custom: { name: 'Custom RTMP', icon: <FaSatelliteDish className="text-teal-400" /> }
    };
    const config = platformConfigs[platform as keyof typeof platformConfigs];

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg m-4">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl flex items-center gap-3">{config.icon} {config.name}</h3>
                    <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
                </div>
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block mb-1 font-semibold text-sm">Server URL</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} disabled={platform === 'facebook'} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold text-sm">คีย์สตรีม (Stream Key)</label>
                        <div className="relative">
                            <input type={showKey ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} className="w-full p-2 pr-10 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600" />
                            <button onClick={() => setShowKey(!showKey)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">{showKey ? <FaEyeSlash /> : <FaEye />}</button>
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
                                    <option value="qsv_h264">Hardware (Intel QSV, H.264)</option> {/* เพิ่ม QSV */}
                                </select>
                            </div>
                             <div>
                                <label className="block mb-1 font-semibold text-sm">Encoder Preset</label>
                                <select value={preset} onChange={e => setPreset(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                                    <option value="quality">เน้นคุณภาพ (Quality)</option>
                                    <option value="balanced">สมดุล (Balanced)</option>
                                    <option value="speed">เน้นความเร็ว (Speed)</option>
                                    <option value="veryfast">Very Fast (x264)</option> {/* เพิ่มสำหรับ x264 */}
                                    <option value="faster">Faster (x264)</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-b-2xl flex justify-end gap-3">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold">ยกเลิก</button>
                    <button onClick={handleSave} className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">ตั้งค่าเป็นปลายทาง</button>
                </div>
            </div>
        </div>
    );
};

export default App;