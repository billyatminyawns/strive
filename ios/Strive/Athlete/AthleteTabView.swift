import SwiftUI

struct AthleteTabView: View {
    @Environment(AppState.self) private var app
    @Environment(\.scenePhase) private var scenePhase
    @State private var store = StudioStore()

    var body: some View {
        TabView(selection: $store.tab) {
            NavigationStack { TodayView() }
                .withMiniPlayer()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(StudioTab.today)
            NavigationStack { ApproveView() }
                .withMiniPlayer()
                .tabItem { Label("Approve", systemImage: "checkmark.seal.fill") }
                .badge(store.queueCount)
                .tag(StudioTab.approve)
            NavigationStack { CaptureView() }
                .withMiniPlayer()
                .tabItem { Label("Capture", systemImage: "mic.fill") }
                .tag(StudioTab.capture)
            NavigationStack { StudioView() }
                .withMiniPlayer()
                .tabItem { Label("Studio", systemImage: "slider.horizontal.3") }
                .tag(StudioTab.studio)
        }
        .environment(store)
        .task {
            await store.refreshAll()
            await PushRegistrar.requestAndRegister()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refreshAll() } }
        }
        .onChange(of: app.pendingRoute) { _, route in
            guard route != nil else { return }
            store.tab = .approve
            app.pendingRoute = nil
        }
    }
}

/// "Hear it in your voice" — renders a draft in the athlete's voice without sending it.
struct VoicePreviewButton: View {
    @Environment(StudioStore.self) private var store
    @Environment(AudioEngine.self) private var audio
    let text: String
    let id: String
    var title = "Preview"

    var body: some View {
        let itemID = "preview:\(id):\(text.trimmed.hashValue)"
        let playing = audio.isPlaying(itemID)
        let loading = store.previewing == text.trimmed || audio.isLoading(itemID)
        Button {
            Task { await store.preview(text: text, id: id, title: title) }
        } label: {
            HStack(spacing: 8) {
                ZStack {
                    if loading {
                        ProgressView().tint(Palette.lav).controlSize(.small)
                    } else {
                        Image(systemName: playing ? "pause.fill" : "play.fill")
                    }
                }
                .frame(width: 16, height: 16)
                Text(playing ? "Pause preview" : "Hear it in your voice")
            }
            .font(.system(size: 13.5, weight: .bold))
            .foregroundStyle(Palette.lav)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Capsule().fill(Palette.lav.opacity(0.1)))
            .overlay(Capsule().strokeBorder(Palette.lav.opacity(0.35)))
        }
        .buttonStyle(.plain)
        .disabled(text.trimmed.isEmpty || (loading && !playing))
        .accessibilityIdentifier("previewVoice")
    }
}
