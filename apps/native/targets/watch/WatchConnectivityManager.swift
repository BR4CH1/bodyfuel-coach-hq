import Foundation
import WatchConnectivity

@MainActor
final class WatchConnectivityManager: NSObject, ObservableObject {
    @Published private(set) var isReachable = false
    @Published private(set) var lastTransferError: String?

    private let session: WCSession?

    override init() {
        if WCSession.isSupported() {
            session = WCSession.default
        } else {
            session = nil
        }
        super.init()
        session?.delegate = self
        session?.activate()
    }

    func send(_ summary: RunSummary) {
        guard let session else { return }
        lastTransferError = nil

        if session.isReachable {
            session.sendMessage(summary.applicationContext, replyHandler: nil) { [weak self] error in
                Task { @MainActor in
                    self?.lastTransferError = error.localizedDescription
                    session.transferUserInfo(summary.applicationContext)
                }
            }
        } else {
            session.transferUserInfo(summary.applicationContext)
        }
    }
}

extension WatchConnectivityManager: @preconcurrency WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let message = error?.localizedDescription
        Task { @MainActor [weak self] in
            self?.isReachable = session.isReachable
            self?.lastTransferError = message
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor [weak self] in
            self?.isReachable = session.isReachable
        }
    }
}
