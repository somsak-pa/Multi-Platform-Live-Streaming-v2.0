use std::process::Command;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn start_ffmpeg(twitch_url: String) {
    // โค้ด Rust สำหรับรัน FFmpeg
    Command::new("ffmpeg")
        .arg("-i")
        .arg("srt://127.0.0.1:10000?mode=listener")
        .arg("-c")
        .arg("copy")
        .arg("-f")
        .arg("flv")
        .arg(&twitch_url)
        .spawn()
        .expect("Failed to start ffmpeg process");
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, start_ffmpeg])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}