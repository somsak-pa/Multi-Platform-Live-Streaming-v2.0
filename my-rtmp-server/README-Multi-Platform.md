# 🚀 Dynamic Multi-Platform RTMP Server

**ระบบ RTMP Server แบบ Dynamic ที่รองรับหลายแพลตฟอร์มและหลายผู้ใช้งาน**

## 🎯 คุณสมบัติหลัก

- ✅ รองรับ **หลายแพลตฟอร์ม** (YouTube, Facebook, Twitch, TikTok, Instagram, LinkedIn, Custom RTMP)
- ✅ รองรับ **หลายผู้ใช้งาน** โดยแต่ละคนมี Stream Keys แยกกัน
- ✅ **ไม่ fix Stream Keys ใน code** - ใช้ไฟล์ JSON แยก
- ✅ **เพิ่ม/ลบ แพลตฟอร์มได้** โดยไม่ต้องแก้ไข code
- ✅ **เปิด/ปิด แพลตฟอร์ม** ได้ตามต้องการ
- ✅ **เครื่องมือจัดการ** แบบ Interactive
- ✅ รายงานสถานะแบบ Real-time
- ✅ ไม่ต้องพึ่งบริการภายนอก

## 📋 ข้อกำหนด

1. **Node.js** (เวอร์ชัน 18 หรือใหม่กว่า)
2. **FFmpeg** (ติดตั้งไว้ที่ `C:/ffmpeg/bin/ffmpeg.exe`)
3. **Stream Keys** จากแต่ละแพลตฟอร์ม

## 🔧 การติดตั้ง

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่าระบบ
ใช้เครื่องมือจัดการ:
```bash
node manage.js
```

## 📁 โครงสร้างไฟล์

```
my-rtmp-server/
├── multi-platform-server.js     # เซิร์ฟเวอร์หลัก
├── manage.js                     # เครื่องมือจัดการ
├── platforms-config.json        # การตั้งค่าแพลตฟอร์ม
├── user-stream-keys.json        # Stream Keys ของผู้ใช้
├── start-multi-platform.bat     # สคริปต์เริ่มต้น (เลือก User)
├── start-user1.bat              # สคริปต์เริ่มต้น User 1
├── start-user2.bat              # สคริปต์เริ่มต้น User 2
└── README-Multi-Platform.md     # คู่มือนี้
```

## 🛠️ การใช้เครื่องมือจัดการ

```bash
node manage.js
```

### เมนูหลัก:
1. **👤 Manage Users** - จัดการผู้ใช้และ Stream Keys
2. **🌐 Manage Platforms** - จัดการแพลตฟอร์มต่างๆ
3. **👁️  View Configuration** - ดูการตั้งค่าปัจจุบัน
4. **🚀 Start Server** - เริ่มเซิร์ฟเวอร์สำหรับ User เฉพาะ

## 👤 การจัดการผู้ใช้

### เพิ่มผู้ใช้ใหม่:
1. เรียกใช้ `node manage.js`
2. เลือก **"1. Manage Users"**
3. เลือก **"1. Add New User"**
4. กรอกข้อมูล:
   - User ID (unique)
   - ชื่อผู้ใช้
   - Email (ไม่บังคับ)

### แก้ไข Stream Keys:
1. เลือก **"2. Edit User"**
2. เลือกผู้ใช้ที่ต้องการแก้ไข
3. กรอก Stream Keys สำหรับแต่ละแพลตฟอร์ม

## 🌐 การจัดการแพลตฟอร์ม

### เพิ่มแพลตฟอร์มใหม่:
1. เลือก **"2. Manage Platforms"**
2. เลือก **"1. Add New Platform"**
3. กรอกข้อมูล:
   - Platform ID (unique)
   - ชื่อแพลตฟอร์ม
   - RTMP URL
   - Icon (emoji)
   - คำอธิบาย
   - เปิดใช้งานหรือไม่

### เปิด/ปิด แพลตฟอร์ม:
1. เลือก **"3. Toggle Platform Status"**
2. เลือกแพลตฟอร์มที่ต้องการเปลี่ยนสถานะ

## 🚀 การเริ่มใช้งาน

### วิธีที่ 1: เลือก User แบบ Interactive
```bash
start-multi-platform.bat
```

### วิธีที่ 2: ระบุ User โดยตรง
```bash
node multi-platform-server.js user1
```

### วิธีที่ 3: ใช้สคริปต์เฉพาะ User
```bash
start-user1.bat
start-user2.bat
```

## 📊 ตัวอย่างไฟล์การตั้งค่า

### platforms-config.json
```json
{
  "youtube": {
    "name": "YouTube",
    "rtmpUrl": "rtmp://a.rtmp.youtube.com/live2/",
    "icon": "🔴",
    "enabled": true,
    "description": "YouTube Live streaming platform"
  },
  "facebook": {
    "name": "Facebook",
    "rtmpUrl": "rtmp://live-api-s.facebook.com:443/rtmp/",
    "icon": "🔵",
    "enabled": true,
    "description": "Facebook Live streaming platform"
  },
  "custom1": {
    "name": "My Custom Platform",
    "rtmpUrl": "rtmp://my-server.com/live/",
    "icon": "🟢",
    "enabled": true,
    "description": "Custom RTMP server"
  }
}
```

### user-stream-keys.json
```json
{
  "streamer1": {
    "name": "Content Creator 1",
    "email": "creator1@example.com",
    "youtube": "ytb-xxxx-xxxx-xxxx",
    "facebook": "fb-yyyy-yyyy-yyyy",
    "twitch": "ttv-zzzz-zzzz-zzzz",
    "custom1": "my-key-1234"
  },
  "streamer2": {
    "name": "Content Creator 2",
    "email": "creator2@example.com",
    "youtube": "ytb-aaaa-bbbb-cccc",
    "facebook": "",
    "twitch": "ttv-dddd-eeee-ffff"
  }
}
```

## 📝 วิธีรับ Stream Keys

### 🔴 **YouTube**
1. ไปที่ [YouTube Studio](https://studio.youtube.com)
2. กด **"Create"** > **"Go Live"**
3. คัดลอก **Stream Key**

### 🔵 **Facebook**
1. ไปที่ [Facebook Live](https://www.facebook.com/live/create)
2. เลือก **"Use stream key"**
3. คัดลอก **Stream Key**

### 🟣 **Twitch**
1. ไปที่ [Twitch Dashboard](https://dashboard.twitch.tv/settings/stream)
2. ดูที่ **"Primary Stream key"**
3. คัดลอก **Stream Key**

### ⚫ **TikTok** (Experimental)
1. ไปที่ TikTok Live Studio
2. รับ Stream Key จากการตั้งค่า

### 🟡 **Instagram** (Experimental)
1. ใช้ Instagram Live API
2. รับ RTMP URL และ Stream Key

## 🔍 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

#### 1. **ไม่พบ FFmpeg**
```
❌ FFmpeg not found!
```
**วิธีแก้**: ติดตั้ง FFmpeg ที่ `C:/ffmpeg/bin/ffmpeg.exe`

#### 2. **Stream Key ไม่ถูกต้อง**
```
❌ YouTube authentication error!
```
**วิธีแก้**: ตรวจสอบ Stream Key ใน `user-stream-keys.json`

#### 3. **ไม่พบผู้ใช้**
```
❌ User 'user3' not found
```
**วิธีแก้**: เพิ่มผู้ใช้ผ่าน `node manage.js` หรือแก้ไข `user-stream-keys.json`

#### 4. **แพลตฟอร์มไม่ทำงาน**
```
⚠️  Platform disabled in configuration
```
**วิธีแก้**: เปิดใช้งานแพลตฟอร์มผ่าน Management Tool

### การตรวจสอบแพลตฟอร์ม

#### YouTube
- ไปที่ [YouTube Studio](https://studio.youtube.com) > **Go Live**
- ดูสถานะ **"Stream health"**

#### Facebook
- ไปที่ [Facebook Creator Studio](https://business.facebook.com/creatorstudio)
- ดูที่ **Live Videos**

#### Twitch
- ไปที่ [Twitch Dashboard](https://dashboard.twitch.tv/)
- ดูสถานะ Stream

## 🎛️ การปรับแต่งขั้นสูง

### แก้ไขคุณภาพสตรีม
แก้ไขใน `multi-platform-server.js`:

```javascript
const ffmpegArgs = [
    '-i', `rtmp://127.0.0.1:1935${streamPath}`,
    '-c:v', 'copy',           // วิดีโอ codec
    '-c:a', 'aac',            // เสียง codec
    '-b:a', '128k',           // เสียง bitrate (เพิ่มเป็น 256k สำหรับคุณภาพดีขึ้น)
    '-ar', '44100',           // sample rate
    '-ac', '2',               // audio channels
    '-f', 'flv',
    '-y',
    `${platform.rtmpUrl}${streamKey}`
];
```

### เพิ่มแพลตฟอร์มใหม่ผ่าน Code
แก้ไข `platforms-config.json`:

```json
{
  "newplatform": {
    "name": "New Platform",
    "rtmpUrl": "rtmp://new.platform.com/live/",
    "icon": "🟡",
    "enabled": true,
    "description": "Description here"
  }
}
```

## 💡 Tips และข้อแนะนำ

1. **เริ่ม RTMP Server ก่อน React App เสมอ**
2. **ตรวจสอบ Console logs เพื่อ debug**
3. **ใช้แค่ Stream Keys ที่ต้องการ** (ไม่จำเป็นต้องครบทุกแพลตฟอร์ม)
4. **รีสตาร์ท Server หลังแก้ไขไฟล์ config**
5. **สำรองไฟล์ config ก่อนแก้ไข**
6. **ใช้ Management Tool แทนการแก้ไขไฟล์โดยตรง**
7. **ตั้งชื่อ User ID ให้สั้นและจำง่าย**
8. **ใช้ Email ใน user config เพื่อความชัดเจน**

## 🚀 การใช้กับ React App

1. **เริ่ม Multi-Platform RTMP Server ก่อน**:
   ```bash
   node multi-platform-server.js user1
   ```

2. **เริ่ม React App**:
   ```bash
   npm run electron-dev
   ```

3. **เชื่อมต่อ OBS** ใน React App

4. **กด Start Stream** - จะสตรีมไปยังทุกแพลตฟอร์มที่:
   - เปิดใช้งาน (enabled: true)
   - มี Stream Key ของ User นั้น

## 🆘 ขอความช่วยเหลือ

หากพบปัญหา ให้ตรวจสอบ:
1. Console logs ของ RTMP Server
2. Console logs ของ React App  
3. สถานะการเชื่อมต่อใน OBS
4. Stream health ในแต่ละแพลตฟอร์ม
5. ไฟล์ config (`platforms-config.json`, `user-stream-keys.json`)

## 📈 ข้อดีของระบบใหม่

✅ **Scalable**: เพิ่มผู้ใช้และแพลตฟอร์มได้ไม่จำกัด  
✅ **Flexible**: ปรับแต่งได้ตามต้องการ  
✅ **Maintainable**: แยกการตั้งค่าออกจาก code  
✅ **User-friendly**: มีเครื่องมือจัดการ  
✅ **Secure**: Stream Keys แยกตาม user  
✅ **Professional**: เหมาะสำหรับการใช้งานจริง  