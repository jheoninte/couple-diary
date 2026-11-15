import Capacitor
import CoreLocation
import UIKit
import WeatherKit

/// Current weather for the home screen, from Apple WeatherKit.
/// Location is requested only when the person taps "show my weather", at reduced (city-level) accuracy,
/// and never leaves the device: only the city name and the weather are returned to the web layer.
@objc(DiaryWeather)
public class DiaryWeather: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "DiaryWeather"
    public let jsName = "DiaryWeather"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openLegal", returnType: CAPPluginReturnPromise)
    ]
    private var manager: CLLocationManager?
    private var waiting: [CAPPluginCall] = []
    private var legalURL: URL?

    private static var supported: Bool {
        if #available(iOS 16.0, *) { return true }
        return false
    }

    private func permission() -> String {
        switch (manager ?? CLLocationManager()).authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["status": self.permission(), "supported": Self.supported]) }
    }

    /// Options: `query` (a place name typed by the user) or `ask` (show the location prompt if undecided).
    @objc func current(_ call: CAPPluginCall) {
        guard Self.supported else { call.resolve(["status": "unsupported"]); return }
        if let query = call.getString("query")?.trimmingCharacters(in: .whitespacesAndNewlines), !query.isEmpty {
            CLGeocoder().geocodeAddressString(query) { places, _ in
                guard let place = places?.first, let location = place.location else { call.resolve(["status": "notFound"]); return }
                self.fetch(location, place: place, calls: [call])
            }
            return
        }
        DispatchQueue.main.async {
            let status = self.permission()
            if status == "denied" { call.resolve(["status": "denied"]); return }
            if status == "prompt" && !(call.getBool("ask") ?? false) { call.resolve(["status": "prompt"]); return }
            if self.manager == nil {
                let manager = CLLocationManager()
                manager.delegate = self
                manager.desiredAccuracy = kCLLocationAccuracyReduced
                self.manager = manager
            }
            self.waiting.append(call)
            if status == "prompt" { self.manager?.requestWhenInUseAuthorization() } else { self.manager?.requestLocation() }
        }
    }

    @objc func openLegal(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = self.legalURL { UIApplication.shared.open(url) }
            call.resolve()
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard !waiting.isEmpty else { return }
        switch permission() {
        case "granted": manager.requestLocation()
        case "denied": finish(["status": "denied"])
        default: break
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let calls = waiting
        waiting.removeAll()
        if !calls.isEmpty { fetch(location, place: nil, calls: calls) }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let calls = waiting
        waiting.removeAll()
        calls.forEach { $0.reject("현재 위치를 확인하지 못했습니다.", nil, error) }
    }

    private func finish(_ data: [String: Any]) {
        let calls = waiting
        waiting.removeAll()
        calls.forEach { $0.resolve(data) }
    }

    private func fetch(_ location: CLLocation, place: CLPlacemark?, calls: [CAPPluginCall]) {
        guard #available(iOS 16.0, *) else { calls.forEach { $0.resolve(["status": "unsupported"]) }; return }
        Task {
            do {
                let weather = try await WeatherService.shared.weather(for: location)
                let attribution = try? await WeatherService.shared.attribution
                var placemark = place
                if placemark == nil { placemark = try? await CLGeocoder().reverseGeocodeLocation(location).first }
                let current = weather.currentWeather
                var result: [String: Any] = [
                    "status": "granted",
                    "symbol": current.symbolName,
                    "temp": current.temperature.converted(to: .celsius).value,
                    "city": placemark?.locality ?? placemark?.administrativeArea ?? placemark?.name ?? ""
                ]
                if let today = weather.dailyForecast.first {
                    result["high"] = today.highTemperature.converted(to: .celsius).value
                    result["low"] = today.lowTemperature.converted(to: .celsius).value
                }
                if let attribution {
                    result["markLight"] = attribution.combinedMarkLightURL.absoluteString
                    result["markDark"] = attribution.combinedMarkDarkURL.absoluteString
                    result["legal"] = attribution.legalPageURL.absoluteString
                    await MainActor.run { self.legalURL = attribution.legalPageURL }
                }
                let payload = result
                await MainActor.run { calls.forEach { $0.resolve(payload) } }
            } catch {
                print("[DiaryWeather] weather failed: \(error)")
                await MainActor.run { calls.forEach { $0.reject("날씨를 불러오지 못했습니다.", nil, error) } }
            }
        }
    }
}
