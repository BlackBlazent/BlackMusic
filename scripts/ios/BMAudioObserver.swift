import AVFoundation
import UIKit
import WebKit

/// FIX-02 (iOS): when a phone call, Siri, an alarm or another app takes the audio, pause BlackMusic; when the system gives it back
/// (and says resuming is appropriate), resume. The web app does the actual pausing through `window.__bmInterruption`
/// (src/lib/mediaSession.ts), so state stays in one place. Added to the Xcode project by scripts/ios-post-init.mjs.
@objc(BMAudioObserver)
public class BMAudioObserver: NSObject {
    private static var installed = false

    @objc public static func install() {
        guard !installed else { return }
        installed = true
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance(), queue: .main) { note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            switch type {
            case .began:
                send("began", resume: false)
            case .ended:
                let opts = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map { AVAudioSession.InterruptionOptions(rawValue: $0) } ?? []
                if opts.contains(.shouldResume) { try? AVAudioSession.sharedInstance().setActive(true) }
                send("ended", resume: opts.contains(.shouldResume))
            @unknown default:
                break
            }
        }
    }

    private static func send(_ phase: String, resume: Bool) {
        guard let web = findWebView() else { return }
        web.evaluateJavaScript("window.__bmInterruption&&window.__bmInterruption('\(phase)',\(resume ? "true" : "false"))", completionHandler: nil)
    }

    private static func findWebView() -> WKWebView? {
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for window in ws.windows { if let w = search(window) { return w } }
        }
        return nil
    }

    private static func search(_ v: UIView) -> WKWebView? {
        if let w = v as? WKWebView { return w }
        for sub in v.subviews { if let w = search(sub) { return w } }
        return nil
    }
}
