import SwiftUI
import WatchKit

struct RunDashboardView: View {
    @EnvironmentObject private var workout: WorkoutManager
    @EnvironmentObject private var connectivity: WatchConnectivityManager
    @State private var sentSummaryID: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                brandHeader

                if workout.isRunning {
                    liveMetrics
                    controls
                } else if let summary = workout.completedSummary {
                    completed(summary)
                } else {
                    startView
                }

                if let error = workout.errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 8)
        }
        .background(Color(red: 0.027, green: 0.063, blue: 0.043))
        .onChange(of: workout.completedSummary?.id) { _, newID in
            guard let summary = workout.completedSummary,
                  newID != nil,
                  newID != sentSummaryID else { return }
            connectivity.send(summary)
            sentSummaryID = newID
        }
    }

    private var brandHeader: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(Color(red: 0.18, green: 0.84, blue: 0.42))
                .frame(width: 8, height: 8)
            Text("BODYFUEL RUN")
                .font(.caption2.weight(.black))
                .tracking(1.1)
            Spacer()
            Image(systemName: connectivity.isReachable ? "iphone.radiowaves.left.and.right" : "iphone.slash")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var startView: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 54))
                .foregroundStyle(Color(red: 0.18, green: 0.84, blue: 0.42))
            Text("Freier Lauf")
                .font(.headline)
            Text("Herzfrequenz, Distanz und Zeit direkt am Handgelenk.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await workout.start() }
            } label: {
                Label("Start", systemImage: "play.fill")
                    .fontWeight(.bold)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.18, green: 0.84, blue: 0.42))
            .foregroundStyle(.black)
        }
        .padding(.top, 10)
    }

    private var liveMetrics: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            VStack(spacing: 8) {
                MetricRow(
                    icon: "timer",
                    value: duration(workout.elapsedSeconds(at: context.date)),
                    label: "ZEIT",
                    color: .white
                )
                MetricRow(
                    icon: "figure.run",
                    value: String(format: "%.2f km", workout.distanceMeters / 1000),
                    label: "DISTANZ",
                    color: Color(red: 0.18, green: 0.84, blue: 0.42)
                )
                MetricRow(
                    icon: "heart.fill",
                    value: workout.heartRateBpm > 0 ? "\(Int(workout.heartRateBpm)) bpm" : "–– bpm",
                    label: "HERZFREQUENZ",
                    color: .red
                )
                MetricRow(
                    icon: "speedometer",
                    value: pace(workout.averagePaceSecondsPerKilometer),
                    label: "Ø PACE",
                    color: .white
                )
            }
        }
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Button {
                workout.isPaused ? workout.resume() : workout.pause()
            } label: {
                Image(systemName: workout.isPaused ? "play.fill" : "pause.fill")
            }
            .tint(.yellow)

            Button(role: .destructive) {
                workout.end()
            } label: {
                Image(systemName: "stop.fill")
            }
        }
    }

    private func completed(_ summary: RunSummary) -> some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(Color(red: 0.18, green: 0.84, blue: 0.42))
            Text("Lauf gespeichert")
                .font(.headline)
            Text(String(format: "%.2f km · %@", summary.distanceMeters / 1000, duration(summary.elapsedSeconds)))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 14)
    }

    private func duration(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        return String(format: "%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
    }

    private func pace(_ secondsPerKilometer: Double?) -> String {
        guard let value = secondsPerKilometer, value.isFinite, value > 0 else { return "–:–– /km" }
        let rounded = Int(value.rounded())
        return String(format: "%d:%02d /km", rounded / 60, rounded % 60)
    }
}

private struct MetricRow: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.headline.monospacedDigit())
                Text(label)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(.secondary)
                    .tracking(0.7)
            }
            Spacer()
        }
        .padding(.vertical, 2)
    }
}
