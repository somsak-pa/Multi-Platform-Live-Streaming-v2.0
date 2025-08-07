// /home/ubuntu/rtmp-backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// กำหนด route POST สำหรับ /api/on_publish (จาก NGINX)
router.post('/on_publish', authController.handleOnPublish);

// Endpoint สำหรับเริ่มต้นกระบวนการ Google OAuth (ผู้ใช้เข้าถึงผ่าน Browser)
router.get('/google-auth', authController.googleAuth);

// Endpoint สำหรับรับ Callback จาก Google OAuth (Google จะ Redirect มาที่นี่)
// ต้องตรงกับ GOOGLE_REDIRECT_URI ที่ตั้งค่าใน Google Cloud Console และ config/index.js
router.get('/oauth2callback', authController.googleOAuthCallback);

module.exports = router;