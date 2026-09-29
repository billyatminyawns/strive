import SwiftUI

struct LibraryView: View {
    @Environment(FanStore.self) private var store
    @State private var segment = Segment.saved

    enum Segment: String, CaseIterable, Identifiable {
        case saved = "Saved replies"
        case drops = "All drops"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Library")
                    .font(.system(size: 30, weight: .heavy))
                    .padding(.top, 6)
                Picker("Show", selection: $segment) {
                    ForEach(Segment.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                switch segment {
                case .saved: saved
                case .drops: drops
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 28)
        }
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable {
            await store.loadQuestions()
            await store.loadDrops()
        }
        .task {
            if !store.threadLoaded { await store.loadQuestions() }
            await store.loadDrops()
        }
    }

    @ViewBuilder
    private var saved: some View {
        if store.savedReplies.isEmpty {
            EmptyStateCard(icon: "bookmark",
                           title: "Nothing saved yet",
                           message: "Tap the bookmark on any reply from \(store.athlete?.firstName ?? "Angela") to keep it here.",
                           actionTitle: "Ask a question") { store.tab = .ask }
        } else {
            ForEach(store.savedReplies) { question in
                VoiceReplyCard(question: question, compact: true)
            }
        }
    }

    @ViewBuilder
    private var drops: some View {
        if !store.dropsLoaded {
            ProgressView().tint(Palette.mint).frame(maxWidth: .infinity).padding(.top, 40)
        } else if store.drops.isEmpty {
            EmptyStateCard(icon: "waveform",
                           title: "No drops yet",
                           message: "Every drop is approved by \(store.athlete?.firstName ?? "Angela") before it's published. The first ones are on the way.")
        } else {
            ForEach(store.drops) { drop in
                DropRow(drop: drop, athlete: store.athlete, badge: drop.pinned == true ? "PINNED" : nil)
            }
        }
    }
}

struct NotificationsView: View {
    @Environment(FanStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 10) {
                if store.notifications.isEmpty {
                    EmptyStateCard(icon: "bell",
                                   title: "You're all caught up",
                                   message: "When \(store.athlete?.firstName ?? "Angela") answers you or ships a new drop, it shows up here.")
                        .padding(.top, 20)
                } else {
                    ForEach(store.notifications) { note in
                        Button {
                            open(note)
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Circle()
                                    .fill(note.read ? Color.clear : Palette.mint)
                                    .frame(width: 8, height: 8)
                                    .padding(.top, 6)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(note.text)
                                        .font(.system(size: 14.5, weight: .bold))
                                        .foregroundStyle(Palette.text)
                                        .multilineTextAlignment(.leading)
                                    if let sub = note.sub {
                                        Text(sub)
                                            .font(.system(size: 13))
                                            .foregroundStyle(Palette.sub)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                    }
                                    Text(Format.relative(note.createdAt))
                                        .font(.system(size: 11))
                                        .foregroundStyle(Palette.dim)
                                }
                                Spacer(minLength: 0)
                            }
                            .card(padding: 14, radius: 16, fill: note.read ? Palette.card : Palette.chipBg,
                                  stroke: note.read ? Palette.line : Palette.chipLine)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .background(Palette.bg)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.loadNotifications()
            try? await Task.sleep(for: .seconds(1.2))
            await store.markNotificationsRead()
        }
    }

    private func open(_ note: AppNotification) {
        if note.link == "ask" { store.tab = .ask }
        dismiss()
    }
}
