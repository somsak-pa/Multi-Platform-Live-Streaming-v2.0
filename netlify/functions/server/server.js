// netlify/functions/server/index.js (หรือ server.js)

// ✅ 1. ไม่ต้องใช้ require('dotenv').config() ใน Netlify Function
//    Environment Variables จะถูกจัดการโดย Netlify Dashboard หรือ netlify.toml
// require('dotenv').config();

// ✅ 2. ไม่ต้องใช้ express หรือ cors middlewares อีกต่อไป
//    เพราะ Netlify Function จัดการ Request/Response ด้วย Handler รูปแบบเฉพาะ
//    และ CORS headers จะถูกกำหนดด้วยตัวเองใน Response ของ Function
// const express = require('express');
// const cors = require('cors');

// ✅ 3. นำเข้า node-fetch (ถ้า Node.js เวอร์ชันต่ำกว่า 18)
//    Node.js v18+ มี fetch API เป็น global แล้ว อาจไม่ต้อง require
const { default: fetch } = require('node-fetch'); // สำหรับ Node.js เวอร์ชัน < 18

// ✅ 4. ไม่ต้องประกาศ PORT หรือ app.listen(...)
//    Netlify จะจัดการการรัน Function ของคุณเอง
// const app = express();
// const PORT = process.env.PORT || 5000;
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// ใน netlify/functions/server/index.js (หรือ server.js)
// Endpoint: /api/auth/restream
// ==========================================================
// ✅ 5. ดึง Environment Variables จาก Netlify Dashboard
//    ค่าเหล่านี้จะถูกตั้งค่าใน Environment Variables ของ Netlify
// ==========================================================
const RESTREAM_CLIENT_ID = process.env.RESTREAM_CLIENT_ID;
const RESTREAM_CLIENT_SECRET = process.env.RESTREAM_CLIENT_SECRET;
const RESTREAM_REDIRECT_URI = process.env.RESTREAM_REDIRECT_URI;
const RESTREAM_OAUTH_AUTH_URL = process.env.RESTREAM_OAUTH_AUTH_URL || 'https://api.restream.io/oauth/authorize';
const RESTREAM_OAUTH_TOKEN_URL = process.env.RESTREAM_OAUTH_TOKEN_URL || 'https://api.restream.io/oauth/token';
const RESTREAM_API_BASE_URL = process.env.RESTREAM_API_BASE_URL || 'https://api.restream.io';

// ✅ 6. คำเตือน: currentRestreamAccessToken ไม่ควรเก็บในตัวแปร Global ของ Function
//    เพราะ Function จะถูกเรียกใช้แยกกันในแต่ละ Request (Stateless)
//    และ Token จะไม่คงอยู่ระหว่าง Request หรือระหว่างผู้ใช้
//    การจัดการ Access Token จะต้องทำบน Front-End และส่งมากับทุก Request
//    หรือเก็บใน Database/Session
// let currentRestreamAccessToken = null;


// ==========================================================
// ✅ 7. นี่คือ Netlify Function Handler หลัก
//    event: มีข้อมูล HTTP Request ทั้งหมด (headers, body, queryStringParameters, httpMethod, path)
//    context: มีข้อมูลเกี่ยวกับ Function (เช่น identity, user)
// ==========================================================
const handler = async (event, context) => {
    // ✅ 7.1 ตั้งค่า Headers สำหรับ CORS (สำคัญมาก)
    const headers = {
        'Access-Control-Allow-Origin': 'https://prismatic-sorbet-b852f8.netlify.app', // ✅ URL Frontend ของคุณ
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json', // บอกเบราว์เซอร์ว่า Response เป็น JSON
    };

    // ✅ 7.2 จัดการ Preflight OPTIONS request สำหรับ CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No Content
            headers: headers,
        };
    }

    // ✅ 7.3 กำหนด Base Path ของ Function (เพื่อให้จัดการ Route ได้ง่ายขึ้น)
    //    Function ของคุณจะถูกเข้าถึงที่ `/.netlify/functions/server`
    //    ดังนั้น /api/auth/restream จะเป็น `/.netlify/functions/server/api/auth/restream`
    const functionBasePath = '/.netlify/functions/server'; // ชื่อ function ที่อยู่ใน netlify/functions/
    const apiPath = event.path.replace(functionBasePath, ''); // เช่นถ้า event.path คือ '/.netlify/functions/server/api/auth/restream', apiPath จะเป็น '/api/auth/restream'

    console.log(`Function received request: ${event.httpMethod} ${event.path}`);
    console.log(`Parsed API Path: ${apiPath}`);


    try {
        // ✅ 7.4 จัดการ Route ต่างๆ (คล้ายกับ Express Router แต่ใช้ if/else if)

        // Route: GET /api/auth/restream (เริ่มต้นกระบวนการ OAuth)
        if (apiPath === '/api/auth/restream' && event.httpMethod === 'GET') {
            if (!RESTREAM_CLIENT_ID || !RESTREAM_REDIRECT_URI) {
                return {
                    statusCode: 500,
                    headers: headers,
                    body: JSON.stringify({ error: 'Restream OAuth configuration is missing (CLIENT_ID or REDIRECT_URI).' }),
                };
            }
            const scopes = 'channels.read channels.write live.read chat.read';
            const authUrl = `${RESTREAM_OAUTH_AUTH_URL}?response_type=code&client_id=${RESTREAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(RESTREAM_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
            
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({ authUrl: authUrl }),
            };

        }
        // Route: GET /auth/restream/callback (Callback URL ที่ Restream เรียก)
        else if (apiPath === '/auth/restream/callback' && event.httpMethod === 'GET') {
            const code = event.queryStringParameters.code; // ดึง code จาก Query Parameters
            const error = event.queryStringParameters.error;

            if (error) {
                console.error('Restream OAuth Error:', error);
                const redirectMessage = encodeURIComponent(error);
                // Redirect ไปที่ Front-End (URL ที่คุณจะรับ token)
                return {
                    statusCode: 302, // Redirect HTTP status code
                    headers: {
                        Location: `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=failed&message=${redirectMessage}`, // ✅ URL Frontend ของคุณ
                    },
                };
            }

            if (!code) {
                const redirectMessage = encodeURIComponent('No authorization code received.');
                return {
                    statusCode: 302,
                    headers: {
                        Location: `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=failed&message=${redirectMessage}`, // ✅ URL Frontend ของคุณ
                    },
                };
            }

            if (!RESTREAM_CLIENT_ID || !RESTREAM_CLIENT_SECRET || !RESTREAM_REDIRECT_URI) {
                console.error('Restream OAuth configuration is missing (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI).');
                const redirectMessage = encodeURIComponent('Server configuration error.');
                return {
                    statusCode: 302,
                    headers: {
                        Location: `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=failed&message=${redirectMessage}`, // ✅ URL Frontend ของคุณ
                    },
                };
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
                    const redirectMessage = encodeURIComponent(errorData.error_description || 'Failed to get access token.');
                    return {
                        statusCode: 302,
                        headers: {
                            Location: `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=failed&message=${redirectMessage}`, // ✅ URL Frontend ของคุณ
                        },
                    };
                }

                const tokenData = await tokenResponse.json();
                console.log('Successfully received Restream tokens:', tokenData);

                // ✅ Redirect กลับไปที่ Front-End พร้อม Access Token
                //    Frontend ของคุณจะอ่าน access_token จาก URL Query Parameter
                const frontendRedirectUrl = `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=success&access_token=${tokenData.access_token}&refresh_token=${tokenData.refresh_token || ''}`;
                
                return {
                    statusCode: 302, // Redirect
                    headers: {
                        Location: frontendRedirectUrl,
                    },
                };

            } catch (error) {
                console.error('Server error during token exchange:', error);
                const redirectMessage = encodeURIComponent('Server error during token exchange.');
                return {
                    statusCode: 302,
                    headers: {
                        Location: `https://prismatic-sorbet-b852f8.netlify.app/settings?auth_status=failed&message=${redirectMessage}`,
                    },
                };
            }
        }
        // Route: GET /api/restream-channels (ดึงข้อมูล Restream Channels)
        else if (apiPath === '/api/restream-channels' && event.httpMethod === 'GET') {
            const authHeader = event.headers.authorization; // ดึง Authorization header จาก event
            const accessToken = authHeader ? authHeader.split(' ')[1] : null;

            if (!accessToken) {
                console.error('Authorization token missing or invalid for /api/restream-channels');
                return {
                    statusCode: 401,
                    headers: headers,
                    body: JSON.stringify({ error: 'Unauthorized: Access Token required.' }),
                };
            }

            try {
                const response = await fetch(`${RESTREAM_API_BASE_URL}/v2/user/channel/all`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    if (response.status === 401 || response.status === 403) {
                        return {
                            statusCode: 401,
                            headers: headers,
                            body: JSON.stringify({ error: 'Unauthorized: Restream Token invalid or expired.' }),
                        };
                    }
                    console.error(`Error from Restream API (${response.status}) fetching channels:`, errorText);
                    return {
                        statusCode: response.status,
                        headers: headers,
                        body: JSON.stringify({ error: `Failed to fetch channels from Restream API: ${errorText}` }),
                    };
                }

                const data = await response.json();
                // Helper function: สำหรับแปลง streamingPlatformId เป็นชื่อ Platform (ย้ายมาไว้ข้างใน handler หรือ Import มา)
                function getPlatformNameById(platformId) {
                    switch (platformId) {
                        case 37: return 'Facebook';
                        case 5:  return 'YouTube';
                        case 7:  return 'Twitch';
                        case 13: return 'X (Twitter)';
                        case 67: return 'TikTok';
                        default: return `Unknown (${platformId})`;
                    }
                }
                const formattedChannels = data.map((channel) => ({
                    id: channel.id,
                    name: channel.displayName || channel.name,
                    platform: getPlatformNameById(channel.streamingPlatformId),
                    status: channel.enabled ? 'online' : 'offline',
                    enabled: channel.enabled,
                    streamingPlatformId: channel.streamingPlatformId,
                    url: channel.url,
                    identifier: channel.identifier,
                    embedUrl: channel.embedUrl
                }));

                return {
                    statusCode: 200,
                    headers: headers,
                    body: JSON.stringify(formattedChannels),
                };

            } catch (error) {
                console.error('Server error fetching Restream channels:', error);
                return {
                    statusCode: 500,
                    headers: headers,
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                };
            }
        }
        // Route: PATCH /api/restream-channels/:id (เปลี่ยนสถานะ Channel)
        else if (apiPath.startsWith('/api/restream-channels/') && event.httpMethod === 'PATCH') {
            const channelId = apiPath.replace('/api/restream-channels/', ''); // ดึง ID จาก Path
            
            // Parse Request Body (สำหรับ PATCH)
            let requestBody;
            try {
                requestBody = JSON.parse(event.body || '{}'); // event.body เป็น string
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: headers,
                    body: JSON.stringify({ error: 'Invalid JSON body.' }),
                };
            }
            const { enabled } = requestBody;

            const authHeader = event.headers.authorization;
            const accessToken = authHeader ? authHeader.split(' ')[1] : null;

            if (!accessToken) {
                console.error('Authorization token missing or invalid for PATCH /api/restream-channels/:id');
                return {
                    statusCode: 401,
                    headers: headers,
                    body: JSON.stringify({ error: 'Unauthorized: Access Token required.' }),
                };
            }

            if (typeof enabled !== 'boolean') {
                return {
                    statusCode: 400,
                    headers: headers,
                    body: JSON.stringify({ error: 'Invalid request: "enabled" must be a boolean.' }),
                };
            }

            try {
                const updateUrl = `${RESTREAM_API_BASE_URL}/v2/user/channel/${channelId}`;

                const response = await fetch(updateUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        active: enabled
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (response.status === 401 || response.status === 403) {
                        return {
                            statusCode: 401,
                            headers: headers,
                            body: JSON.stringify({ error: 'Unauthorized: Restream Token invalid or expired.' }),
                        };
                    }
                    console.error(`Error from Restream API (${response.status}) updating channel ${channelId}:`, errorData);
                    return {
                        statusCode: response.status,
                        headers: headers,
                        body: JSON.stringify({ error: `Failed to update channel status: ${errorData.message || response.statusText}` }),
                    };
                }

                const updatedChannel = await response.json();
                console.log(`Successfully updated channel ${channelId} to enabled=${enabled}:`, updatedChannel);
                return {
                    statusCode: 200,
                    headers: headers,
                    body: JSON.stringify(updatedChannel),
                };

            } catch (error) {
                console.error('Server error updating Restream channel status:', error);
                return {
                    statusCode: 500,
                    headers: headers,
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                };
            }
        }
        // ✅ จัดการ Route ที่ไม่รู้จัก
        else {
            return {
                statusCode: 404,
                headers: headers,
                body: JSON.stringify({ message: "API Route Not Found" }),
            };
        }

    } catch (error) {
        console.error("Critical error in Netlify Function handler:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message || String(error) }),
        };
    }
};

module.exports = { handler }; // ✅ Export handler function