// src/components/StreamDetailsModal.tsx
import React, { FC, useState } from 'react';
import { FaUpload } from 'react-icons/fa6'; // หรือ FaCloudUploadAlt, FaImage

interface StreamDetailsModalProps {
    onClose: () => void;
    // คุณอาจส่งข้อมูลปัจจุบันของ Stream เข้ามาใน Modal ด้วย
    // currentTitle?: string;
    // currentDescription?: string;
    // currentThumbnailUrl?: string;
    // ✅ รับ onSave เพื่อบันทึกข้อมูล (channelId, title, description)
    onSave: (channelId: string, title: string, description: string) => Promise<boolean>;
    // คุณอาจต้องส่ง channelId ของช่องที่ต้องการอัปเดตเข้ามาด้วย
    // สำหรับตอนนี้เราจะใช้ placeholder channelId
}

const StreamDetailsModal: FC<StreamDetailsModalProps> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState(''); // หรือ currentTitle
    const [description, setDescription] = useState(''); // หรือ currentDescription
    const [isSaving, setIsSaving] = useState(false); // สำหรับ Loading State
    const thumbnailInputRef = useRef<HTMLInputElement>(null); // สำหรับ upload

    // ✅ ฟังก์ชันสำหรับบันทึก
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // ✅ แทนที่ด้วย channelId จริง (อาจส่งมาจาก App.tsx หรือดึงจาก State ของ App)
        // สำหรับตอนนี้ ใช้ placeholder
        const placeholderChannelId = "primary_channel_id"; // <<< คุณต้องเปลี่ยนตรงนี้ให้เป็น Channel ID จริง

        try {
            const success = await onSave(placeholderChannelId, title, description);
            if (success) {
                onClose(); // ปิด modal เมื่อบันทึกสำเร็จ
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleThumbnailUploadClick = () => {
        thumbnailInputRef.current?.click(); // คลิก input file ที่ซ่อนอยู่
    };

    const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            console.log("Selected thumbnail file:", file.name);
            // ✅ Logic สำหรับ Upload Thumbnail ไปยัง Restream API (ซับซ้อนกว่า PATCH)
            // Restream API มี /v2/user/channel/{id}/thumbnail PUT request
            // ซึ่งต้องส่งเป็น multipart/form-data และ Base64-encoded
            // อาจจะต้องทำผ่าน Backend Function แยก
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg m-4">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl">Stream details</h3>
                    <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
                </div>
                <p className="px-4 pt-2 text-sm text-gray-500 dark:text-gray-400">
                    All channels in this setup will be updated.
                </p>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="stream-title" className="block mb-1 font-semibold text-sm">Title</label>
                        <input
                            type="text"
                            id="stream-title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Stream via RTMP (OBS, Vmix, Zoom) with Restream"
                            className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="stream-description" className="block mb-1 font-semibold text-sm">Description</label>
                        <textarea
                            id="stream-description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Restream helps you multistream & reach your audience, wherever they are."
                            rows={3}
                            className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>
                    <div>
                        <label className="block mb-1 font-semibold text-sm">Thumbnail</label>
                        <input
                            type="file"
                            ref={thumbnailInputRef}
                            onChange={handleThumbnailFileChange}
                            accept="image/*"
                            className="hidden" // ซ่อน input file
                        />
                        <button
                            type="button" // สำคัญ: กำหนด type เป็น button เพื่อไม่ให้ submit form
                            onClick={handleThumbnailUploadClick}
                            className="w-full py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold flex items-center justify-center text-sm"
                        >
                            <FaUpload className="mr-2" /> Upload
                        </button>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} disabled={isSaving} className="py-2 px-4 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                            {isSaving ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Update All'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ✅ อย่าลืม export StreamDetailsModal ถ้าสร้างเป็นไฟล์แยก
export default StreamDetailsModal;