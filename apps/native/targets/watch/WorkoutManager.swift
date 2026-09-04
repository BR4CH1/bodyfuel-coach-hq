import Foundation
import HealthKit
import WatchKit

@MainActor
final class WorkoutManager: NSObject, ObservableObject {
    @Published private(set) var isRunning = false
    @Published private(set) var isPaused = false
    @Published private(set) var heartRateBpm = 0.0
    @Published private(set) var averageHeartRateBpm = 0.0
    @Published private(set) var distanceMeters = 0.0
    @Published private(set) var activeEnergyKilocalories = 0.0
    @Published private(set) var completedSummary: RunSummary?
    @Published private(set) var errorMessage: String?

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?
    private var startedAt: Date?
    private var pausedAt: Date?
    private var accumulatedPauseSeconds: TimeInterval = 0

    func start() async {
        guard !isRunning else { return }
        errorMessage = nil
        completedSummary = nil

        guard HKHealthStore.isHealthDataAvailable() else {
            errorMessage = "HealthKit ist auf dieser Watch nicht verfügbar."
            return
        }

        do {
            try await requestAuthorization()

            let configuration = HKWorkoutConfiguration()
            configuration.activityType = .running
            configuration.locationType = .outdoor

            let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            session.delegate = self
            builder.delegate = self

            let now = Date()
            workoutSession = session
            workoutBuilder = builder
            startedAt = now
            pausedAt = nil
            accumulatedPauseSeconds = 0
            heartRateBpm = 0
            averageHeartRateBpm = 0
            distanceMeters = 0
            activeEnergyKilocalories = 0
            isRunning = true
            isPaused = false

            session.startActivity(with: now)
            builder.beginCollection(withStart: now) { [weak self] success, error in
                if success { return }
                let message = error?.localizedDescription ?? "Workout-Daten konnten nicht gestartet werden."
                Task { @MainActor in
                    self?.errorMessage = message
                    self?.end()
                }
            }
            WKInterfaceDevice.current().play(.start)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pause() {
        guard isRunning, !isPaused else { return }
        workoutSession?.pause()
        pausedAt = Date()
        isPaused = true
        WKInterfaceDevice.current().play(.click)
    }

    func resume() {
        guard isRunning, isPaused else { return }
        if let pausedAt {
            accumulatedPauseSeconds += Date().timeIntervalSince(pausedAt)
        }
        self.pausedAt = nil
        workoutSession?.resume()
        isPaused = false
        WKInterfaceDevice.current().play(.start)
    }

    func end() {
        guard isRunning else { return }
        if let pausedAt {
            accumulatedPauseSeconds += Date().timeIntervalSince(pausedAt)
            self.pausedAt = nil
        }
        workoutSession?.end()
        WKInterfaceDevice.current().play(.stop)
    }

    func elapsedSeconds(at date: Date = Date()) -> TimeInterval {
        guard let startedAt else { return 0 }
        let livePause = pausedAt.map { date.timeIntervalSince($0) } ?? 0
        return max(0, date.timeIntervalSince(startedAt) - accumulatedPauseSeconds - livePause)
    }

    var averagePaceSecondsPerKilometer: Double? {
        guard distanceMeters >= 20 else { return nil }
        return elapsedSeconds() / (distanceMeters / 1000)
    }

    private func requestAuthorization() async throws {
        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        let read: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
        ]
        try await healthStore.requestAuthorization(toShare: share, read: read)
    }

    private func applyStatistics(
        heartRate: Double?,
        averageHeartRate: Double?,
        distance: Double?,
        energy: Double?
    ) {
        if let heartRate { heartRateBpm = heartRate }
        if let averageHeartRate { averageHeartRateBpm = averageHeartRate }
        if let distance { distanceMeters = distance }
        if let energy { activeEnergyKilocalories = energy }
    }

    private func finish(at endDate: Date) {
        guard let builder = workoutBuilder, let startedAt else {
            resetLiveState()
            return
        }

        builder.endCollection(withEnd: endDate) { [weak self] success, error in
            guard success else {
                let message = error?.localizedDescription ?? "Workout konnte nicht abgeschlossen werden."
                Task { @MainActor in
                    self?.errorMessage = message
                    self?.resetLiveState()
                }
                return
            }

            builder.finishWorkout { [weak self] workout, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let error {
                        self.errorMessage = error.localizedDescription
                    }
                    let actualEnd = workout?.endDate ?? endDate
                    self.completedSummary = RunSummary(
                        id: workout?.uuid.uuidString ?? UUID().uuidString,
                        startedAt: workout?.startDate ?? startedAt,
                        endedAt: actualEnd,
                        elapsedSeconds: self.elapsedSeconds(at: actualEnd),
                        distanceMeters: self.distanceMeters,
                        averageHeartRateBpm: self.averageHeartRateBpm > 0 ? self.averageHeartRateBpm : nil,
                        activeEnergyKilocalories: self.activeEnergyKilocalories
                    )
                    self.resetLiveState()
                }
            }
        }
    }

    private func resetLiveState() {
        isRunning = false
        isPaused = false
        workoutSession = nil
        workoutBuilder = nil
        startedAt = nil
        pausedAt = nil
        accumulatedPauseSeconds = 0
    }
}

extension WorkoutManager: @preconcurrency HKWorkoutSessionDelegate {
    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        guard toState == .ended else { return }
        Task { @MainActor [weak self] in
            self?.finish(at: date)
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor [weak self] in
            self?.errorMessage = message
            self?.resetLiveState()
        }
    }
}

extension WorkoutManager: @preconcurrency HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        var latestHeartRate: Double?
        var averageHeartRate: Double?
        var distance: Double?
        var energy: Double?

        for sampleType in collectedTypes {
            guard let quantityType = sampleType as? HKQuantityType,
                  let statistics = workoutBuilder.statistics(for: quantityType) else { continue }

            switch quantityType.identifier {
            case HKQuantityTypeIdentifier.heartRate.rawValue:
                let unit = HKUnit.count().unitDivided(by: .minute())
                latestHeartRate = statistics.mostRecentQuantity()?.doubleValue(for: unit)
                averageHeartRate = statistics.averageQuantity()?.doubleValue(for: unit)
            case HKQuantityTypeIdentifier.distanceWalkingRunning.rawValue:
                distance = statistics.sumQuantity()?.doubleValue(for: .meter())
            case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
                energy = statistics.sumQuantity()?.doubleValue(for: .kilocalorie())
            default:
                break
            }
        }

        Task { @MainActor [weak self] in
            self?.applyStatistics(
                heartRate: latestHeartRate,
                averageHeartRate: averageHeartRate,
                distance: distance,
                energy: energy
            )
        }
    }
}
