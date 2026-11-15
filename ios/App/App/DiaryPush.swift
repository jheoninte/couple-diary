import Capacitor
import UIKit
import UserNotifications

/// Owns the notification center delegate from launch, so a tap that cold-starts the app is not lost
/// before the web view and plugin exist. The plugin drains what was buffered here.
final class DiaryPushCenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = DiaryPushCenter()
    var onToken: ((Result<String, Error>) -> Void)?
    var onOpen: (([String: Any]) -> Void)? { didSet { flush() } }
    private var pendingOpens: [[String: Any]] = []

    func didRegister(_ deviceToken: Data) {
        onToken?(.success(deviceToken.map { String(format: "%02x", $0) }.joined()))
    }
    func didFail(_ error: Error) { onToken?(.failure(error)) }

    // While the app is open the partner's activity still shows as a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        var data: [String: Any] = [:]
        for (key, value) in response.notification.request.content.userInfo {
            if let key = key as? String, key != "aps", let value = value as? String { data[key] = value }
        }
        pendingOpens.append(data)
        flush()
        completionHandler()
    }

    private func flush() {
        guard let onOpen else { return }
        let rows = pendingOpens
        pendingOpens.removeAll()
        rows.forEach(onOpen)
    }
}

@objc(DiaryPush)
public class DiaryPush: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryPush"
    public let jsName = "DiaryPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    private var waiting: [CAPPluginCall] = []

    public override func load() {
        DiaryPushCenter.shared.onToken = { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                let calls = self.waiting
                self.waiting.removeAll()
                for call in calls {
                    switch result {
                    case .success(let token): call.resolve(["status": "granted", "token": token, "environment": Self.environment])
                    case .failure(let error): call.reject("알림을 등록하지 못했습니다.", nil, error)
                    }
                }
            }
        }
        DiaryPushCenter.shared.onOpen = { [weak self] data in
            self?.notifyListeners("opened", data: data, retainUntilConsumed: true)
        }
    }

    // Debug builds are signed with the development aps-environment; TestFlight and App Store use production.
    private static var environment: String {
        #if DEBUG
        return "development"
        #else
        return "production"
        #endif
    }

    private static func name(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            call.resolve(["status": Self.name(settings.authorizationStatus)])
        }
    }

    /// Shows the system prompt only when undecided, then returns the APNs device token.
    @objc func register(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                let status = Self.name(settings.authorizationStatus)
                guard granted || status == "granted" else { call.resolve(["status": status]); return }
                DispatchQueue.main.async {
                    self.waiting.append(call)
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var target = UIApplication.openSettingsURLString
            if #available(iOS 16.0, *) { target = UIApplication.openNotificationSettingsURLString }
            if let url = URL(string: target) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }
}
