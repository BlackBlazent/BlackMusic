mod audio_tools;
mod file_open;
mod importer;
mod metadata;
mod tools;
#[allow(dead_code)]
use tauri::Manager;
#[cfg(desktop)]
use tauri::Emitter;

/// Closes the native mini-player window. Done in Rust (not JS `window.close()`) so it works without any extra
/// window permission; the `Destroyed` hook below then tells every window via `pip:closed`.
#[cfg(desktop)]
#[tauri::command]
fn close_pip(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("pip") {
        let _ = window.destroy();
    }
}

#[cfg(mobile)]
#[tauri::command]
fn close_pip() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().manage(file_open::PendingOpen::default());

    // MUST be registered first. With the `deep-link` feature it forwards a blackmusic://auth/callback launch to the
    // already-running window instead of spawning a second instance. 2.2.0: it also receives the argv of a second
    // launch, which is how "Open with BlackMusic" reaches an app that's already running.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            file_open::dispatch(app, file_open::paths_from_args(args.into_iter().skip(1)));
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(desktop)]
    let builder = builder.on_window_event(|window, event| {
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
    });

    let app = builder
        .invoke_handler(tauri::generate_handler![
            importer::scan_folder_fast,
            importer::cancel_scan,
            importer::storage_probe,
            importer::read_cover,
            metadata::write_metadata,
            metadata::read_full_tags,
            close_pip,
            file_open::take_pending_opens,
            tools::ytdlp_run,
            tools::ytdlp_update,
            tools::tool_status,
            tools::tool_import,
            tools::tool_reset,
            tools::whisper_list_models,
            tools::whisper_download_model,
            tools::whisper_import_model,
            tools::whisper_delete_model,
            tools::whisper_transcribe,
            tools::whisper_cancel,
            tools::ffmpeg_run,
            audio_tools::export_trim,
            audio_tools::analyze_loudness,
            audio_tools::default_music_dirs,
        ])
        .setup(|_app| {
            // Dev builds aren't installed, so register the blackmusic:// scheme at runtime.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register_all();
            }
            // "Open with" at cold start (Windows/Linux pass the file as an argument).
            #[cfg(desktop)]
            {
                let paths = file_open::paths_from_args(std::env::args().skip(1));
                file_open::dispatch(_app.handle(), paths);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building BlackMusic");

    app.run(|_handle, _event| {
        // macOS / iOS deliver "Open with" through a native event rather than argv.
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            file_open::dispatch(_handle, file_open::filter_supported(paths));
        }
    });
}
