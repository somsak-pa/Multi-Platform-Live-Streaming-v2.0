// src-tauri/src/lib.rs
// ลบบรรทัด use tauri_plugin_node; ออกไป

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


pub fn run() {
    tauri::Builder::default()
        // ลบบรรทัด .plugin(tauri_plugin_opener::init()) ออกไป
        // ลบบรรทัด .plugin(tauri_plugin_node::init()) ออกไป
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}