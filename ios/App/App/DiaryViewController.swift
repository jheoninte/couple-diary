import Capacitor

class DiaryViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DiaryStore())
    }
}
