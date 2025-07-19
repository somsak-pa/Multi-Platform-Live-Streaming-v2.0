// src/components/CommentsTab.tsx
import React, { useState, FC } from 'react';
// แก้ไขชื่อไอคอนตรงนี้
import { FaPaperPlane, FaExclamation } from 'react-icons/fa6';
import { Comment as CustomComment } from '../types'; // เพิ่ม as CustomComment
interface CommentsTabProps {
     comments: CustomComment[]; // เปลี่ยนเป็น CustomComment[]
    onSendComment: (text: string) => void;
    chatEmbedUrl?: string | null;
}

const CommentsTab: FC<CommentsTabProps> = ({ onSendComment, chatEmbedUrl }) => {
    const [commentInput, setCommentInput] = useState('');

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
                {chatEmbedUrl ? (
                    <iframe
                        src={chatEmbedUrl}
                        frameBorder="0"
                        className="w-full h-full bg-gray-200 dark:bg-gray-800"
                        title="Restream Embedded Chat"
                    ></iframe>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                        {/* และแก้ไขชื่อไอคอนตรงนี้ */}
                        <FaExclamation className="text-4xl text-yellow-500 mb-4" />
                        <h3 className="font-bold text-lg">ยังไม่ได้ตั้งค่า Live Chat</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            กรุณาไปที่หน้า 'ตั้งค่า' เพื่อใส่ Restream Chat Embed URL
                        </p>
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

export default CommentsTab;