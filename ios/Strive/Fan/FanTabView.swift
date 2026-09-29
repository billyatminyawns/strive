import SwiftUI

struct FanTabView: View {
    @Environment(AppState.self) private var app
    @Environment(\.scenePhase) private var scenePhase
    @State private var store = FanStore()

    var body: some View {
        TabView(selection: $store.tab) {
            NavigationStack { HomeView() }
                .withMiniPlayer()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(FanTab.home)
            NavigationStack { AskView() }
                .withMiniPlayer()
                .tabItem { Label("Ask", systemImage: "bubble.left.and.text.bubble.right.fill") }
                .tag(FanTab.ask)
            NavigationStack { LibraryView() }
                .withMiniPlayer()
                .tabItem { Label("Library", systemImage: "books.vertical.fill") }
                .tag(FanTab.library)
            NavigationStack { YouView() }
                .withMiniPlayer()
                .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
                .tag(FanTab.you)
        }
        .environment(store)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refreshAll() } }
        }
        .onChange(of: app.pendingRoute) { _, route in
            guard let route else { return }
            store.tab = route == .home ? .home : .ask
            app.pendingRoute = nil
        }
    }
}
