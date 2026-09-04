import SwiftUI

@main
struct BodyFuelWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager()
    @StateObject private var connectivityManager = WatchConnectivityManager()

    var body: some Scene {
        WindowGroup {
            RunDashboardView()
                .environmentObject(workoutManager)
                .environmentObject(connectivityManager)
        }
    }
}
