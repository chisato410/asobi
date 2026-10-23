import ScreenSaver
import WebKit

/// ネコスペースのスクリーンセーバー。
/// サイト(Resources/site/ に同梱)を `?saver` モード(UIなし・操作なし・猫が勝手にぶつかり合う)で
/// 全画面表示するだけ。ネット接続も、本番サイトの状態も要らない(オフラインで完結する)。
///
/// ES Modules や 3Dモデルの読み込みは file:// だと制限されるので、`nekospace://app/` という
/// 独自スキームで同梱ファイルを返す(WKURLSchemeHandler)。
@objc(NekoSpaceView)
final class NekoSpaceView: ScreenSaverView {
    private static let scheme = "nekospace"
    private static let pageURL = URL(string: "nekospace://app/index.html?saver")!
    private static let background = NSColor(
        calibratedRed: 5.0 / 255, green: 6.0 / 255, blue: 15.0 / 255, alpha: 1
    )

    private var webView: WKWebView?
    private var schemeHandler: SiteSchemeHandler?

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        commonInit()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }

    private func commonInit() {
        wantsLayer = true
        layer?.backgroundColor = Self.background.cgColor
    }

    override func startAnimation() {
        super.startAnimation()
        guard webView == nil else { return }

        guard let resources = Bundle(for: NekoSpaceView.self).resourceURL else { return }
        let handler = SiteSchemeHandler(root: resources.appendingPathComponent("site"))
        schemeHandler = handler

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(handler, forURLScheme: Self.scheme)

        let web = WKWebView(frame: bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.underPageBackgroundColor = Self.background
        let spiStatus = Self.disableOcclusionDetection(on: web)
        addSubview(web)
        webView = web
        web.load(URLRequest(url: Self.pageURL))
        #if NEKOSPACE_DEBUG
        startDebugOverlay(spiStatus: spiStatus)
        #endif
    }

    /// WebKit は、ウィンドウが「他に隠れている/表示されていない」と判断したページの描画
    /// (requestAnimationFrame)を止めて、WebContentプロセスもバックグラウンドへ降格させる。
    /// セーバーはシステム側が用意したウィンドウに載って動くので、これに引っかかって真っ黒になる
    /// (macOS 14.5 の legacyScreenSaver で確認: 読み込みは完了するが、約0.6秒後にバックグラウンド化)。
    /// そこで遮蔽判定を無効にして、描画を止めさせない。
    /// 非公開APIなので、存在しない環境でも落ちないよう responds(to:) を確かめてから呼ぶ。
    @discardableResult
    private static func disableOcclusionDetection(on web: WKWebView) -> String {
        let selector = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
        guard web.responds(to: selector) else { return "missing" }
        typealias SetBool = @convention(c) (AnyObject, Selector, Bool) -> Void
        let setter = unsafeBitCast(web.method(for: selector), to: SetBool.self)
        setter(web, selector, false)
        return "applied"
    }

    /// セーバーが止まったら、WebViewごと確実に破棄する(裏でGPUやCPUを使い続けないため)。
    override func stopAnimation() {
        super.stopAnimation()
        #if NEKOSPACE_DEBUG
        stopDebugOverlay()
        #endif
        webView?.stopLoading()
        webView?.removeFromSuperview()
        webView = nil
        schemeHandler = nil
    }

    /// 描画はWebView側がやるので、フレームごとの処理は不要。
    override func animateOneFrame() {}

    override var hasConfigureSheet: Bool { false }
    override var configureSheet: NSWindow? { nil }

    #if NEKOSPACE_DEBUG
    // ---- 診断用(./build.sh --debug のときだけ入る) ----------------------------------
    // 画面の隅に状態を表示し、同じ内容を NSLog にも出す。黒い画面のまま原因を探るためのもの。
    private var debugLabel: NSTextField?
    private var debugTimer: Timer?
    private var debugSPI = "n/a"
    private var debugLastFrames = 0

    private func startDebugOverlay(spiStatus: String) {
        debugSPI = spiStatus
        let label = NSTextField(labelWithString: "NekoSpace debug …")
        label.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        label.textColor = .white
        label.drawsBackground = true
        label.backgroundColor = NSColor.black.withAlphaComponent(0.65)
        label.maximumNumberOfLines = 0
        label.frame = NSRect(x: 12, y: 12, width: min(max(bounds.width - 24, 100), 900), height: 70)
        label.autoresizingMask = [.maxXMargin, .maxYMargin]
        addSubview(label)
        debugLabel = label

        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in self?.debugTick() }
        RunLoop.main.add(timer, forMode: .common)
        debugTimer = timer
    }

    private func stopDebugOverlay() {
        debugTimer?.invalidate()
        debugTimer = nil
        debugLabel?.removeFromSuperview()
        debugLabel = nil
    }

    private func debugTick() {
        guard let web = webView else { return }
        let native = "win.visible=\(window?.isVisible ?? false) occl.visible=\(window?.occlusionState.contains(.visible) ?? false) "
            + "view=\(Int(bounds.width))x\(Int(bounds.height)) preview=\(isPreview) occlusionSPI=\(debugSPI) build=\(BuildInfo.stamp)"
        let probe = "JSON.stringify({vis: document.visibilityState, frames: window.__frames || 0, "
            + "canvas: !!document.querySelector('canvas'), mode: document.documentElement.dataset.mode})"
        web.evaluateJavaScript(probe) { [weak self] result, error in
            guard let self else { return }
            var page = "page: "
            if let json = result as? String,
               let data = json.data(using: .utf8),
               let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let frames = object["frames"] as? Int ?? 0
                let fps = frames - self.debugLastFrames
                self.debugLastFrames = frames
                page += "vis=\(object["vis"] ?? "?") fps=\(fps) frames=\(frames) "
                    + "canvas=\(object["canvas"] ?? "?") mode=\(object["mode"] ?? "?")"
            } else {
                page += "JS失敗 error=\(error.map { "\($0)" } ?? "none") result=\(String(describing: result))"
            }
            self.debugLabel?.stringValue = "NekoSpace debug\n\(native)\n\(page)"
            NSLog("[NekoSpaceDebug] %@ | %@", native, page)
        }
    }
    #endif
}

/// `nekospace://app/<path>` を、バンドル内の `site/<path>` のファイルとして返す。
private final class SiteSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    /// 環境変数 NEKOSPACE_SAVER_DEBUG があるときだけ、返したファイルを標準エラーに出す(動作確認用)。
    private let debug = ProcessInfo.processInfo.environment["NEKOSPACE_SAVER_DEBUG"] != nil

    private static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8",
        "json": "application/json",
        "glb": "model/gltf-binary",
        "png": "image/png",
        "svg": "image/svg+xml",
    ]

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var path = url.path.removingPercentEncoding ?? url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let fileURL = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        // 同梱フォルダの外(../ など)は返さない
        guard fileURL.path.hasPrefix(root.path + "/"),
              let data = try? Data(contentsOf: fileURL)
        else {
            log("404 \(path)")
            respond(to: urlSchemeTask, url: url, status: 404, mime: "text/plain", data: Data("not found".utf8))
            return
        }

        let mime = Self.mimeTypes[fileURL.pathExtension.lowercased()] ?? "application/octet-stream"
        log("200 \(path) \(data.count)B \(mime)")
        respond(to: urlSchemeTask, url: url, status: 200, mime: mime, data: data)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respond(to task: WKURLSchemeTask, url: URL, status: Int, mime: String, data: Data) {
        let headers = [
            "Content-Type": mime,
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
        ]
        guard let response = HTTPURLResponse(
            url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers
        ) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func log(_ message: String) {
        if debug { fputs("[NekoSpace] \(message)\n", stderr) }
    }
}
