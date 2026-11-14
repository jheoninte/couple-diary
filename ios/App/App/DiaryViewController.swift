import Capacitor
import UIKit

class DiaryViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DiaryStore())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Behave like a native app: the page never zooms. The viewport meta (maximum-scale=1, user-scalable=no)
        // blocks focus/double-tap zoom; this also turns off pinch. WKWebView stays the scroll view's delegate.
        guard let scrollView = webView?.scrollView else { return }
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 1
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }
}
