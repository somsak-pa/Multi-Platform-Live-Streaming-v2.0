// /home/ubuntu/rtmp-backend/controllers/authController.js
const config = require('../config');
const { google } = require('googleapis');

// สร้าง OAuth2 client instance (ใช้อันเดียวกันกับที่ส่งไปให้ Google)
const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI
);

// Endpoint สำหรับเริ่มต้นกระบวนการ Google OAuth
exports.googleAuth = (req, res) => {
    // Scopes ที่เราต้องการสำหรับ YouTube Data API v3
    // youtube.force-ssl: จัดการวิดีโอ YouTube และ Live Stream
    // userinfo.email: อ่านอีเมลผู้ใช้ (เป็นทางเลือกสำหรับระบุผู้ใช้)
    const scopes = [
        'https://www.googleapis.com/auth/youtube.force-ssl',
        'https://www.googleapis.com/auth/userinfo.email',
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // สำคัญ: เพื่อให้ได้ refresh_token
        scope: scopes,
        prompt: 'consent', // เพื่อให้ผู้ใช้เห็นหน้ายินยอมเสมอเมื่อขอ refresh_token
    });

    console.log(`[Google OAuth]: Redirecting to: ${authorizationUrl}`);
    res.redirect(authorizationUrl);
};

// Endpoint สำหรับรับ Callback จาก Google OAuth และแลกเปลี่ยน Token
exports.googleOAuthCallback = async (req, res) => {
    const code = req.query.code; // รับ authorization_code จาก Query Parameter

    if (!code) {
        console.error('[Google OAuth Callback]: No authorization code received.');
        return res.status(400).send('Authorization code not found.');
    }

    try {
        // แลกเปลี่ยน authorization_code เป็น access_token และ refresh_token
        const { tokens } = await oauth2Client.getToken(code);
        console.log('[Google OAuth Callback]: Tokens received:', tokens);

        // *** สำคัญ: ตรงนี้คือที่ที่คุณจะต้องบันทึก tokens.refresh_token ลงในฐานข้อมูล ***
        // เพื่อใช้ในภายหลังโดยไม่ต้องให้ผู้ใช้ล็อกอินซ้ำ
        // สำหรับการทดสอบ เราจะแสดงผลลัพธ์และ log
        console.log('[Google OAuth Callback]: Access Token:', tokens.access_token);
        console.log('[Google OAuth Callback]: Refresh Token:', tokens.refresh_token || 'No Refresh Token (if not requested or first time)');

        // คุณอาจจะ Redirect ผู้ใช้ไปยังหน้า Dashboard หรือหน้ายืนยันความสำเร็จ
        // ในที่นี้ เราส่งหน้า HTML กลับไปแสดง Token
        res.send(`
            <h1>Google OAuth successful!</h1>
            <p>Access Token: <strong>${tokens.access_token}</strong></p>
            <p>Refresh Token: <strong>${tokens.refresh_token || 'N/A (first time or not applicable)'}</strong></p>
            <p>Please copy the Refresh Token and store it securely.</p>
            <p>You can now close this tab.</p>
        `);

    } catch (error) {
        console.error('[Google OAuth Callback]: Error retrieving tokens:', error.message);
        if (error.response && error.response.data) {
            console.error('[Google OAuth Callback]: Google API Error Response:', error.response.data);
        }
        res.status(500).send('Authentication failed.');
    }
};

// Endpoint สำหรับ Stream Key Verification จาก NGINX (เมื่อ OBS เริ่มสตรีม)
exports.handleOnPublish = (req, res) => {
    const streamKey = req.body.name;

    console.log(`Stream Key received: ${streamKey}`);

    if (streamKey === config.STREAM_KEY) {
        console.log('Access GRANTED.');
        return res.status(200).send('OK');
    }

    console.log('Access DENIED.');
    res.status(403).send('Forbidden');
};