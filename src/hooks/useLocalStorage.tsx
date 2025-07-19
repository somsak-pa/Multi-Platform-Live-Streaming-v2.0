// ไฟล์: src/hooks/useLocalStorage.ts (หรือ .js)

import { useState, useEffect } from 'react';
import React from 'react'; // เผื่อใช้ React.Dispatch

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    // ... โค้ด useLocalStorage Hook ที่สมบูรณ์พร้อม useEffect ...
    const readValue = (): T => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    };

    const [storedValue, setStoredValue] = useState<T>(readValue);

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    };

    // *** ส่วนสำคัญ: useEffect เพื่อจัดการ dark class ***
    useEffect(() => {
       
        if (key === 'theme-dark' && typeof window !== 'undefined') {

            if (storedValue) {

                document.documentElement.classList.add('dark');
            } else {

                document.documentElement.classList.remove('dark');
            }
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

// *** export default สำหรับ useLocalStorage อยู่ในไฟล์นี้ ***
export default useLocalStorage;