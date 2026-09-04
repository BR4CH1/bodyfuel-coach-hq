import Foundation
import WatchConnectivity

let bodyFuelWatchRunReceived = Notification.Name("BodyFuelWatchRunReceived")

final class BodyFuelWatchSessionStore: NSObject, WCSessionDelegate, @unchecked Sendable {
  static let shared = BodyFuelWatchSessionStore()

  private let defaultsKey = "bodyfuel.native.watch-inbox.v1"
  private let lock = NSLock()

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate !== self {
      session.delegate = self
    }
    if session.activationState != .activated {
      session.activate()
    }
  }

  func availability() -> [String: Any] {
    guard WCSession.isSupported() else {
      return ["supported": false, "paired": false, "watchAppInstalled": false, "reachable": false]
    }
    let session = WCSession.default
    return [
      "supported": true,
      "paired": session.isPaired,
      "watchAppInstalled": session.isWatchAppInstalled,
      "reachable": session.isReachable,
    ]
  }

  func pendingSummaries() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    return UserDefaults.standard.array(forKey: defaultsKey) as? [[String: Any]] ?? []
  }

  func acknowledge(ids: [String]) {
    guard !ids.isEmpty else { return }
    let acknowledged = Set(ids)
    lock.lock()
    defer { lock.unlock() }
    let remaining = (UserDefaults.standard.array(forKey: defaultsKey) as? [[String: Any]] ?? [])
      .filter { summary in
        guard let id = summary["id"] as? String else { return false }
        return !acknowledged.contains(id)
      }
    UserDefaults.standard.set(remaining, forKey: defaultsKey)
  }

  private func receive(_ payload: [String: Any]) {
    guard let summary = normalize(payload) else { return }

    lock.lock()
    var pending = UserDefaults.standard.array(forKey: defaultsKey) as? [[String: Any]] ?? []
    pending.removeAll { $0["id"] as? String == summary["id"] as? String }
    pending.insert(summary, at: 0)
    UserDefaults.standard.set(Array(pending.prefix(30)), forKey: defaultsKey)
    lock.unlock()

    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: bodyFuelWatchRunReceived,
        object: nil,
        userInfo: ["summary": summary]
      )
    }
  }

  private func normalize(_ payload: [String: Any]) -> [String: Any]? {
    guard payload["type"] as? String == "bodyfuel.run.completed.v1",
          let id = payload["id"] as? String,
          let startedAtMs = milliseconds(payload["startedAt"]),
          let endedAtMs = milliseconds(payload["endedAt"]),
          let elapsedSeconds = number(payload["elapsedSeconds"]),
          let distanceMeters = number(payload["distanceMeters"]),
          let activeEnergyKilocalories = number(payload["activeEnergyKilocalories"]) else {
      return nil
    }

    var summary: [String: Any] = [
      "id": id,
      "startedAtMs": startedAtMs,
      "endedAtMs": endedAtMs,
      "elapsedSeconds": elapsedSeconds,
      "distanceMeters": distanceMeters,
      "activeEnergyKilocalories": activeEnergyKilocalories,
      "source": "watch",
    ]
    if let averageHeartRateBpm = number(payload["averageHeartRateBpm"]) {
      summary["averageHeartRateBpm"] = averageHeartRateBpm
    }
    return summary
  }

  private func milliseconds(_ value: Any?) -> Double? {
    if let date = value as? Date { return date.timeIntervalSince1970 * 1_000 }
    return number(value)
  }

  private func number(_ value: Any?) -> Double? {
    if let number = value as? NSNumber { return number.doubleValue }
    if let value = value as? Double { return value }
    return nil
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receive(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receive(userInfo)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    receive(applicationContext)
  }
}
