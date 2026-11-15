import Capacitor
import CryptoKit
import Foundation

/// On-device photo cache in Library/Caches (not backed up to iCloud; iOS may purge it under storage pressure).
/// Diary photos are immutable (UUID file names), so a cached file never goes stale. Least recently used
/// files are removed once the cache passes 1,500 MB.
@objc(DiaryPhotoCache)
public class DiaryPhotoCache: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryPhotoCache"
    public let jsName = "DiaryPhotoCache"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lookup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]
    static let limitBytes: Int64 = 1500 * 1024 * 1024
    static let maxFileBytes = 2 * 1024 * 1024
    private static let queue = DispatchQueue(label: "diary.photo-cache", qos: .utility)
    private static let directory: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("diary-photos", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }()

    private static func file(for path: String) -> URL {
        let digest = SHA256.hash(data: Data(path.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(digest + ".jpg")
    }

    /// Returns the cached files among `paths` and marks them as recently used.
    @objc func lookup(_ call: CAPPluginCall) {
        let paths = (call.getArray("paths") as? [String]) ?? []
        Self.queue.async {
            var files: [String: String] = [:]
            let now = Date()
            for path in paths {
                let url = Self.file(for: path)
                if FileManager.default.fileExists(atPath: url.path) {
                    files[path] = url.path
                    try? FileManager.default.setAttributes([.modificationDate: now], ofItemAtPath: url.path)
                }
            }
            call.resolve(["files": files])
        }
    }

    /// Downloads `items` ([{path, url}], https signed URLs) in parallel straight into the cache.
    @objc func fetch(_ call: CAPPluginCall) {
        let items = (call.getArray("items") as? [JSObject]) ?? []
        Task {
            var files: [String: String] = [:]
            await withTaskGroup(of: (String, String?).self) { group in
                for item in items {
                    guard let path = item["path"] as? String, let raw = item["url"] as? String,
                          let url = URL(string: raw), url.scheme == "https" else { continue }
                    group.addTask { (path, await Self.download(url, to: Self.file(for: path))) }
                }
                for await (path, file) in group { if let file { files[path] = file } }
            }
            Self.queue.async { Self.trim() }
            call.resolve(["files": files])
        }
    }

    /// Stores a photo that arrived another way (the server fallback returns a data URL).
    @objc func save(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let dataUrl = call.getString("dataUrl"),
              let comma = dataUrl.firstIndex(of: ","), let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])),
              !data.isEmpty, data.count <= Self.maxFileBytes else { call.resolve([:]); return }
        Self.queue.async {
            let url = Self.file(for: path)
            do { try data.write(to: url, options: .atomic); call.resolve(["file": url.path]) }
            catch { call.resolve([:]) }
            Self.trim()
        }
    }

    /// Removes every cached photo (sign-out, account deletion, leaving a space).
    @objc func clear(_ call: CAPPluginCall) {
        Self.queue.async {
            try? FileManager.default.removeItem(at: Self.directory)
            try? FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
            call.resolve()
        }
    }

    private static func download(_ url: URL, to destination: URL) async -> String? {
        do {
            let (temporary, response) = try await URLSession.shared.download(from: url)
            defer { try? FileManager.default.removeItem(at: temporary) }
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            let size = (try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard size > 0, size <= maxFileBytes else { return nil }
            try? FileManager.default.removeItem(at: destination)
            try FileManager.default.moveItem(at: temporary, to: destination)
            return destination.path
        } catch {
            print("[DiaryPhotoCache] download failed: \(error.localizedDescription)")
            return nil
        }
    }

    /// Least recently used first, down to 90% of the limit so trimming does not run on every download.
    private static func trim() {
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey]
        guard let urls = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys) else { return }
        var rows: [(url: URL, size: Int64, date: Date)] = urls.compactMap { url in
            guard let values = try? url.resourceValues(forKeys: Set(keys)) else { return nil }
            return (url, Int64(values.fileSize ?? 0), values.contentModificationDate ?? .distantPast)
        }
        var total = rows.reduce(0) { $0 + $1.size }
        guard total > limitBytes else { return }
        rows.sort { $0.date < $1.date }
        for row in rows where total > limitBytes * 9 / 10 {
            try? FileManager.default.removeItem(at: row.url)
            total -= row.size
        }
    }
}
