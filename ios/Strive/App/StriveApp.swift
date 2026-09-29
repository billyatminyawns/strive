import SwiftUI

@main
struct StriveApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var app = AppState.shared
    @State private var audio = AudioEngine.shared
    @State private var toasts = ToastCenter.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .environment(audio)
                .environment(toasts)
        }
        .backgroundTask(.appRefresh(BackgroundRefresh.identifier)) {
            await BackgroundRefresh.run()
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var app
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            switch app.phase {
            case .launching:
                LaunchView()
            case .signedOut:
                WelcomeView()
                    .transition(.opacity)
            case .interests:
                InterestsView()
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case .fan:
                FanTabView()
                    .transition(.opacity)
            case .athlete:
                AthleteTabView()
                    .transition(.opacity)
            }
        }
        .overlay { ToastOverlay() }
        .animation(.easeInOut(duration: 0.3), value: app.phase)
        .preferredColorScheme(.dark)
        .tint(Palette.mint)
        .foregroundStyle(Palette.text)
        .task { await app.bootstrap() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background, app.user != nil { BackgroundRefresh.schedule() }
        }
    }
}

struct LaunchView: View {
    var body: some View {
        VStack(spacing: 18) {
            Wordmark(size: 34)
            ProgressView().tint(Palette.mint)
        }
    }
}
