import Foundation

struct RunSummary: Identifiable, Equatable {
    let id: String
    let startedAt: Date
    let endedAt: Date
    let elapsedSeconds: TimeInterval
    let distanceMeters: Double
    let averageHeartRateBpm: Double?
    let activeEnergyKilocalories: Double

    var applicationContext: [String: Any] {
        var payload: [String: Any] = [
            "type": "bodyfuel.run.completed.v1",
            "id": id,
            "startedAt": startedAt,
            "endedAt": endedAt,
            "elapsedSeconds": elapsedSeconds,
            "distanceMeters": distanceMeters,
            "activeEnergyKilocalories": activeEnergyKilocalories,
        ]
        if let averageHeartRateBpm {
            payload["averageHeartRateBpm"] = averageHeartRateBpm
        }
        return payload
    }
}
