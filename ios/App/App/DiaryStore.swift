import Foundation
import Capacitor
import StoreKit

@objc(DiaryStore)
public class DiaryStore: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DiaryStore"
    public let jsName = "DiaryStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private let identifiers: Set<String> = ["com.interest.couplediary.plus.monthly", "com.interest.couplediary.plus.yearly"]
    private var updates: Task<Void, Never>?
    @MainActor private var transactions: [String: StoreKit.Transaction] = [:]

    public override func load() {
        print("[DiaryStore] loaded")
        updates = Task { @MainActor [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result, self.identifiers.contains(transaction.productID) {
                    print("[DiaryStore] transactionUpdated: \(transaction.id) \(transaction.productID)")
                    self.transactions[String(transaction.id)] = transaction
                    self.notifyListeners("transactionUpdated", data: ["signedTransaction": result.jwsRepresentation], retainUntilConsumed: true)
                }
            }
        }
    }
    deinit { updates?.cancel() }

    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let rows = try await Product.products(for: identifiers)
                print("[DiaryStore] products loaded: \(rows.count)")
                call.resolve(["products": rows.map { ["id": $0.id, "displayPrice": $0.displayPrice, "displayName": $0.displayName,
                                                      "amount": NSDecimalNumber(decimal: $0.price).doubleValue,
                                                      "currency": $0.priceFormatStyle.currencyCode] }])
            } catch {
                print("[DiaryStore] products failed: \(error)")
                call.reject("App Store 상품을 불러오지 못했습니다.", nil, error)
            }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), identifiers.contains(id),
              let rawToken = call.getString("appAccountToken"), let token = UUID(uuidString: rawToken) else {
            print("[DiaryStore] purchase invalid arguments")
            call.reject("상품 또는 계정 정보를 확인해주세요."); return
        }
        Task { @MainActor in
            do {
                print("[DiaryStore] purchasing \(id)")
                guard let product = try await Product.products(for: [id]).first else { call.reject("구매할 상품을 찾지 못했습니다."); return }
                switch try await product.purchase(options: [.appAccountToken(token)]) {
                case .success(let result):
                    guard case .verified(let transaction) = result else { call.reject("Apple 거래 검증에 실패했습니다."); return }
                    transactions[String(transaction.id)] = transaction
                    print("[DiaryStore] purchase success: \(transaction.id)")
                    call.resolve(["status": "purchased", "signedTransaction": result.jwsRepresentation])
                case .pending:
                    print("[DiaryStore] purchase pending")
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    print("[DiaryStore] purchase cancelled")
                    call.resolve(["status": "cancelled"])
                @unknown default: call.reject("알 수 없는 결제 상태입니다.")
                }
            } catch {
                print("[DiaryStore] purchase failed: \(error)")
                call.reject("구매를 완료하지 못했습니다.", nil, error)
            }
        }
    }
    @MainActor private func collect() async -> [[String: String]] {
        var rows: [String: String] = [:]
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let t) = result, identifiers.contains(t.productID) {
                transactions[String(t.id)] = t; rows[String(t.id)] = result.jwsRepresentation
            }
        }
        for await result in StoreKit.Transaction.unfinished {
            if case .verified(let t) = result, identifiers.contains(t.productID) {
                transactions[String(t.id)] = t; rows[String(t.id)] = result.jwsRepresentation
            }
        }
        print("[DiaryStore] collect found \(rows.count) transactions")
        return rows.values.map { ["signedTransaction": $0] }
    }
    @objc func pending(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(["transactions": await collect()]) }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                print("[DiaryStore] restoring purchases")
                try await AppStore.sync()
                call.resolve(["transactions": await collect()])
            } catch {
                print("[DiaryStore] restore failed: \(error)")
                call.reject("구매 복원을 완료하지 못했습니다.", nil, error)
            }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = call.getString("transactionId"), let t = transactions[id] else {
                print("[DiaryStore] finish: transaction not found \(call.getString("transactionId") ?? "nil")")
                call.reject("확인할 거래를 찾을 수 없습니다."); return
            }
            print("[DiaryStore] finishing transaction \(id)")
            await t.finish(); transactions.removeValue(forKey: id); call.resolve()
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else { call.reject("앱 화면을 확인할 수 없습니다."); return }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("구독 관리를 열지 못했습니다.", nil, error) }
        }
    }
}
