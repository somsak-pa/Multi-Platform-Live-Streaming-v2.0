// server.js
require('dotenv').config(); // โหลด Environment Variables จากไฟล์ .env

const express = require('express');
const cors = require('cors');

const { default: fetch } = require('node-fetch'); // สำหรับเรียก Restream API
const app = express();
const PORT = process.env.PORT || 5000; // ใช้ port 5000 หรือตามที่ Environment กำหนด

// Middleware สำหรับอนุญาต Cross-Origin Requests (CORS)
// สำคัญ: ใน Production ควรระบุ origin ที่แน่นอนของ Front-End ของคุณ
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:1420'], // URL ของ React App ของคุณ
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
}));

// Middleware สำหรับการอ่าน JSON body ใน request
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================================
// ตัวแปรสำหรับ Restream OAuth และ API
// ==========================================================
const RESTREAM_CLIENT_ID = process.env.RESTREAM_CLIENT_ID;
const RESTREAM_CLIENT_SECRET = process.env.RESTREAM_CLIENT_SECRET;
const RESTREAM_REDIRECT_URI = process.env.RESTREAM_REDIRECT_URI;
const RESTREAM_OAUTH_AUTH_URL = 'https://api.restream.io/oauth/authorize'; // URL สำหรับขอ Authorization
const RESTREAM_OAUTH_TOKEN_URL = 'https://api.restream.io/oauth/token';   // URL สำหรับแลก Token
const RESTREAM_API_BASE_URL = 'https://api.restream.io';                // URL สำหรับ Restream API

// ตัวแปร Global สำหรับเก็บ Access Token ที่ได้จากการ Login OAuth
// **คำเตือน: การเก็บ Access Token ในตัวแปร Global แบบนี้ไม่ปลอดภัยสำหรับ Production**
// สำหรับ Production ควรใช้ Session, Database หรือ Redis ในการจัดเก็บ Token ที่เชื่อมโยงกับผู้ใช้
let currentRestreamAccessToken = null;

// (ไม่จำเป็นต้องใช้ RESTREAM_ACCESS_TOKEN จาก .env อีกต่อไป ถ้าใช้ OAuth Flow)
// const RESTREAM_ACCESS_TOKEN = process.env.RESTREAM_ACCESS_TOKEN;
// console.log('RESTREAM_ACCESS_TOKEN loaded:', RESTREAM_ACCESS_TOKEN ? 'EXISTS' : 'MISSING');

// ==========================================================
// Endpoint: สำหรับเริ่มต้นกระบวนการ OAuth (บน Front-End จะเรียก EndPoint นี้)
// ==========================================================
app.get('/api/auth/restream', (req, res) => {
    if (!RESTREAM_CLIENT_ID || !RESTREAM_REDIRECT_URI) {
        return res.status(500).json({ error: 'Restream OAuth configuration is missing (CLIENT_ID or REDIRECT_URI).' });
    }

    // กำหนด scopes ให้ครอบคลุมการจัดการช่อง (channels.read, channels.write, live.read)
    // channels.write จะทำให้เราสามารถเปลี่ยนสถานะ enabled/disabled ได้
    const scopes = 'channels.read channels.write live.read';

    const authUrl = `${RESTREAM_OAUTH_AUTH_URL}?response_type=code&client_id=${RESTREAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(RESTREAM_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;

    res.json({ authUrl });
});

// ==========================================================
// Endpoint: Callback URL ที่ Restream จะเรียกหลังจากผู้ใช้ Login และอนุมัติ
// ==========================================================
app.get('/auth/restream/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;

    if (error) {
        console.error('Restream OAuth Error:', error);
        return res.redirect(`http://localhost:1420/settings?auth_status=failed&message=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return res.redirect(`http://localhost:1420/settings?auth_status=failed&message=${encodeURIComponent('No authorization code received.')}`);
    }

    if (!RESTREAM_CLIENT_ID || !RESTREAM_CLIENT_SECRET || !RESTREAM_REDIRECT_URI) {
        console.error('Restream OAuth configuration is missing (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI).');
        return res.redirect(`http://localhost:1420/settings?auth_status=failed&message=${encodeURIComponent('Server configuration error.')}`);
    }

   try {
        const tokenResponse = await fetch(RESTREAM_OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: RESTREAM_CLIENT_ID,
                client_secret: RESTREAM_CLIENT_SECRET,
                redirect_uri: RESTREAM_REDIRECT_URI,
                code: code,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Error exchanging code for token:', errorData);
            return res.redirect(`http://localhost:1420/settings?auth_status=failed&message=${encodeURIComponent(errorData.error_description || 'Failed to get access token.')}`);
        }

        const tokenData = await tokenResponse.json();
        console.log('Successfully received Restream tokens:', tokenData);

        // จัดเก็บ Access Token ที่เพิ่งได้มาในตัวแปร Global
        //currentRestreamAccessToken = tokenData.access_token;

        // Redirect กลับไปที่ Front-End โดยส่ง access_token (และ refresh_token ถ้าต้องการ)
        // **คำเตือน: ไม่ควรส่ง Access Token ตรงๆ ผ่าน URL ใน Production ควรใช้ HttpOnly cookie หรือ Session**
        res.redirect(`http://localhost:1420/settings?auth_status=success&access_token=${tokenData.access_token}&refresh_token=${tokenData.refresh_token}`);

    } catch (error) {
        console.error('Server error during token exchange:', error);
        res.redirect(`http://localhost:1420/settings?auth_status=failed&message=${encodeURIComponent('Server error during token exchange.')}`);
    }
});

// ==========================================================
// Helper function: สำหรับแปลง streamingPlatformId เป็นชื่อ Platform
// ==========================================================
function getPlatformNameById(platformId) {
    switch (platformId) {
        case 37: return 'Facebook';
        case 5:  return 'YouTube';
        case 7:  return 'Twitch'; // Twitch
        case 13: return 'X (Twitter)'; // X (Twitter) - ต้องยืนยัน ID อีกครั้ง
        case 67: return 'TikTok'; // X (Twitter) - ต้องยืนยัน ID อีกครั้ง
        // เพิ่ม case อื่นๆ ตาม streamingPlatformId ที่คุณเจอ
        // Restream.io มี platform IDs เยอะมาก ควรดูจาก API documentation
        default: return `Unknown (${platformId})`; // แสดง ID ที่ไม่รู้จักด้วย
    }
}

// ==========================================================
// Endpoint: สำหรับดึงข้อมูล Restream Channels
// GET /api/restream-channels
// ==========================================================
app.get('/api/restream-channels', async (req, res) => {
    // ตรวจสอบว่ามี Token ใน Server memory หรือไม่
    // หากไม่มีใน memory แต่ Front-End ส่งมาใน Header (ซึ่งควรทำใน Production), เราควรดึงจาก Header
    const authHeader = req.headers.authorization;
    let accessToken = currentRestreamAccessToken; // ใช้จาก global ก่อน
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // หาก Front-End ส่งมาใน Header ก็ใช้จาก Header (แนะนำสำหรับ Production)
        console.error('Authorization header missing or invalid for /api/restream-channels');
        return res.status(401).json({ error: 'Unauthorized: Access Token required.' });
        
    }
        accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
        console.error('No active Restream Access Token. User needs to login.');
        return res.status(401).json({ error: 'Unauthorized: No active Restream session.' });
    }

    try {
        // console.log('Using token to fetch channels. Token length:', accessToken.length); // ลด log
        const response = await fetch(`${RESTREAM_API_BASE_URL}/v2/user/channel/all`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // ใช้ accessToken จาก Header
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401 || response.status === 403) {
                return res.status(401).json({ error: 'Unauthorized: Restream Token invalid or expired.' });
            }
            console.error(`Error from Restream API (${response.status}) fetching channels:`, errorText);
            return res.status(response.status).json({ error: `Failed to fetch channels from Restream API: ${errorText}` });
        }

        const data = await response.json();
        // console.log('--- RAW DATA FROM RESTREAM API ---'); // คอมเมนต์ไว้เพื่อลด log
        // console.log(data);
        // console.log('----------------------------------');

        // แปลงข้อมูลจาก Restream API ให้เป็นรูปแบบที่ Front-End ต้องการ
        const formattedChannels = data.map((channel) => ({
            id: channel.id,
            name: channel.displayName || channel.name, // ใช้ displayName ก่อน ถ้าไม่มีใช้ name
            platform: getPlatformNameById(channel.streamingPlatformId),
            status: channel.enabled ? 'online' : 'offline', // ใช้ channel.enabled โดยตรง
            enabled: channel.enabled, // เพิ่ม field enabled ให้ตรงกับ API
            streamingPlatformId: channel.streamingPlatformId, // เพิ่ม ID เผื่อไว้ใช้ใน Frontend
            url: channel.url,
            identifier: channel.identifier,
            embedUrl: channel.embedUrl
        }));

        res.json(formattedChannels);

    } catch (error) {
        console.error('Server error fetching Restream channels:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================================
// Endpoint: สำหรับเปลี่ยนสถานะ Channel (เปิด/ปิด)
// PATCH /api/restream-channels/:id
// ==========================================================
app.patch('/api/restream-channels/:id', async (req, res) => {
    const channelId = req.params.id; // ดึง id ของ channel จาก URL
    const { enabled } = req.body;   // ดึงสถานะ enabled (true/false) จาก body ของ Request

    // ตรวจสอบ accessToken เหมือนเดิม
    const authHeader = req.headers.authorization;
    let accessToken = currentRestreamAccessToken;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Authorization header missing or invalid for /api/restream-channels/:id');
        return res.status(401).json({ error: 'Unauthorized: Access Token required.' });
    }
        accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
        console.error('No active Restream Access Token for PATCH. User needs to login.');
        return res.status(401).json({ error: 'Unauthorized: No active Restream session to update.' });
    }

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Invalid request: "enabled" must be a boolean.' });
    }

    try {
        const updateUrl = `${RESTREAM_API_BASE_URL}/v2/user/channel/${channelId}`;

        const response = await fetch(updateUrl, {
            method: 'PATCH', // ใช้ PATCH method
            headers: {
                'Authorization': `Bearer ${accessToken}`, // <--- ใช้ accessToken ตรงนี้
                'Content-Type': 'application/json' // Restream API สำหรับ PATCH มักจะรับ JSON
            },
            body: JSON.stringify({
                active: enabled // ส่งค่า enabled ที่ต้องการอัปเดต
            })
        });

        if (!response.ok) {
            const errorData = await response.json(); // หรือ response.text()
            if (response.status === 401 || response.status === 403) {
                return res.status(401).json({ error: 'Unauthorized: Restream Token invalid or expired.' });
            }
            console.error(`Error from Restream API (${response.status}) updating channel ${channelId}:`, errorData);
            return res.status(response.status).json({ error: `Failed to update channel status: ${errorData.message || response.statusText}` });
        }

        const updatedChannel = await response.json();
        console.log(`Successfully updated channel ${channelId} to enabled=${enabled}:`, updatedChannel);
        res.json(updatedChannel); // ส่งข้อมูล Channel ที่อัปเดตแล้วกลับไป

    } catch (error) {
        console.error('Server error updating Restream channel status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// ==========================================================
// เริ่มต้น Server
// ==========================================================
app.listen(PORT, () => {
    console.log(`Restream API Back-End Server running on http://localhost:${PORT}`);
    console.log(`OAuth Auth URL: ${RESTREAM_OAUTH_AUTH_URL}`);
    console.log(`OAuth Token URL: ${RESTREAM_OAUTH_TOKEN_URL}`);
    console.log(`API Base URL: ${RESTREAM_API_BASE_URL}`);
    console.log(`Redirect URI: ${RESTREAM_REDIRECT_URI}`);
});