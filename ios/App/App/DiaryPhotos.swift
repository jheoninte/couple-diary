import Foundation
import Capacitor
import PhotosUI
import UIKit

/// Opens the system photo picker directly (no "Photo Library / Take Photo / Choose File" menu that a web file input shows).
/// Returns JPEG data URLs; the web layer re-compresses and strips metadata exactly as for other photos.
@objc(DiaryPhotos)
public class DiaryPhotos: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "DiaryPhotos"
    public let jsName = "DiaryPhotos"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?

    @objc func pick(_ call: CAPPluginCall) {
        let limit = max(1, min(call.getInt("limit") ?? 3, 3))
        DispatchQueue.main.async {
            var config = PHPickerConfiguration()
            config.filter = .images
            config.selectionLimit = limit
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.pending = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pending else { return }
        pending = nil
        if results.isEmpty { call.resolve(["photos": []]); return }
        var photos = [String?](repeating: nil, count: results.count)
        let group = DispatchGroup()
        for (index, result) in results.enumerated() where result.itemProvider.canLoadObject(ofClass: UIImage.self) {
            group.enter()
            result.itemProvider.loadObject(ofClass: UIImage.self) { object, _ in
                defer { group.leave() }
                guard let image = object as? UIImage else { return }
                let scaled = Self.scale(image, maxSide: 2048)
                if let data = scaled.jpegData(compressionQuality: 0.9) {
                    photos[index] = "data:image/jpeg;base64," + data.base64EncodedString()
                }
            }
        }
        group.notify(queue: .main) { call.resolve(["photos": photos.compactMap { $0 }]) }
    }

    private static func scale(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let side = max(image.size.width, image.size.height)
        guard side > maxSide else { return image }
        let ratio = maxSide / side
        let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}
