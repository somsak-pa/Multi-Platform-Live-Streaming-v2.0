#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ✅ เพิ่ม Emitter trait เข้ามา
use tauri::{AppHandle, Emitter}; 
use tokio::process::Command;
use tokio::io::{BufReader, AsyncBufReadExt};
use tokio::task;

// ✅ แก้ไขตรงนี้
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")] 
struct FfmpegArgs {
    destinations: Vec<String>,
    srtInput: String,
}

#[tauri::command]
async fn ffmpeg_start(app_handle: AppHandle, args: FfmpegArgs) -> Result<String, String> {
    let ffmpeg_path = "ffmpeg"; 
    
    // ✅ บรรทัดนี้ที่ทำให้เกิด Error เมื่อไม่ได้ derive(Debug)
    println!("Received args from frontend: {:?}", args);
    
    let mut command_args = vec![
        "-i".to_string(),
        args.srtInput.clone(),
        "-c".to_string(),
        "copy".to_string(),
    ];
    
    for dest in args.destinations {
        command_args.push("-f".to_string());
        command_args.push("flv".to_string());
        command_args.push(dest);
    }
    
    println!("Running FFmpeg with arguments: {:?}", command_args);

    let mut child = Command::new(ffmpeg_path)
        .args(&command_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;
    
    let stderr = child.stderr.take().ok_or_else(|| "Failed to get stderr".to_string())?;

    let app_handle_clone = app_handle.clone(); // Clone app_handle เพื่อใช้ใน async block
    task::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();
        while let Ok(bytes) = reader.read_line(&mut line).await {
            if bytes == 0 {
                break;
            }
            app_handle_clone.emit("ffmpeg-log", &line).unwrap();
            line.clear();
        }
    });

    Ok("FFmpeg process started successfully.".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![ffmpeg_start])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}