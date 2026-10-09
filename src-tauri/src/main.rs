// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod importer;
mod metadata;

use tauri::{Emitter, Manager};

/// Closes the native mini-player window. Done in Rust (not JS `window.close()`) so it works without any extra
/// window permission; the `Destroyed` hook below then tells every window via `pip:closed`.
#[tauri::command]
fn close_pip(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("pip") {
        let _ = window.destroy();
    }
}

fn main() {
    tauri::Builder::default()
        // MUST be registered first. With the `deep-link` feature it forwards a
        // blackmusic://auth/callback launch to the already-running window instead of
        // spawning a second instance — this is what makes sign-in actually land.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                match window.label() {
                    // Closing the main window must end the app even if the mini player is still open.
                    "main" => window.app_handle().exit(0),
                    // Any way the mini player goes away (X, Alt+F4, OS, close_pip) -> let the main window un-toggle PiP.
                    "pip" => {
                        let _ = window.app_handle().emit("pip:closed", ());
                    }
                    _ => {}
                }
            }
        })

        .invoke_handler(tauri::generate_handler![
            importer::scan_folder_fast,
            importer::read_cover,
            metadata::write_metadata,
            close_pip,
        ])
        .setup(|_app| {
            // Dev builds aren't installed, so register the blackmusic:// scheme at runtime.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register_all();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running BlackMusic");
}