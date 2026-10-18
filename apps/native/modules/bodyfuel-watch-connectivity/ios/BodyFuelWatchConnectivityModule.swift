import ExpoModulesCore

public final class BodyFuelWatchConnectivityModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BodyFuelWatchConnectivity")
    Events("onRunSummary")

    OnCreate {
      BodyFuelWatchSessionStore.shared.activate()
      self.observer = NotificationCenter.default.addObserver(
        forName: bodyFuelWatchRunReceived,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let summary = notification.userInfo?["summary"] as? [String: Any] else { return }
        self?.sendEvent("onRunSummary", summary)
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observer = nil
    }

    AsyncFunction("getAvailabilityAsync") { () -> [String: Any] in
      BodyFuelWatchSessionStore.shared.activate()
      return BodyFuelWatchSessionStore.shared.availability()
    }

    AsyncFunction("getPendingSummariesAsync") { () -> [[String: Any]] in
      BodyFuelWatchSessionStore.shared.activate()
      return BodyFuelWatchSessionStore.shared.pendingSummaries()
    }

    AsyncFunction("acknowledgeSummariesAsync") { (ids: [String]) in
      BodyFuelWatchSessionStore.shared.acknowledge(ids: ids)
    }
  }
}

public final class BodyFuelWatchAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  @MainActor
  public func subscriberDidRegister() {
    BodyFuelWatchSessionStore.shared.activate()
  }
}
