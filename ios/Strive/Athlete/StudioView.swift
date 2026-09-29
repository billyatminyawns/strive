import SwiftUI

struct StudioView: View {
    @Environment(StudioStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var editingBio = false
    @State private var confirmSignOut = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Studio")
                    .font(.system(size: 30, weight: .heavy))
                    .padding(.top, 6)
                coachCard
                guardrailsCard
                availabilityCard
                bioCard
                performanceCard
                accountCard
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 30)
        }
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable {
            await store.loadSettings()
            await store.loadDrops()
            await store.loadBio()
        }
        .task {
            await store.loadSettings()
            await store.loadDrops()
            await store.loadBio()
        }
        .sheet(isPresented: $editingBio) { BioEditorView() }
        .confirmationDialog("Sign out of your studio?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await app.signOut() } }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var coachCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("Your Coach · voice model", color: Palette.lav)
            HStack(spacing: 12) {
                AthleteAvatar(athlete: app.athlete, size: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.athlete?.coach ?? "Coach Angela")
                        .font(.system(size: 18, weight: .heavy))
                    Text("Your digital twin — fans hear you, trained by you")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.dim2)
                }
            }
            HStack(spacing: 14) {
                capability("Drafting", on: app.config.drafting)
                capability("Voice", on: app.config.voice)
                capability("Push", on: app.config.push)
            }
            Text("Your Coach only ever says words you wrote or approved. Every clip is labelled as your AI voice.")
                .font(.system(size: 12))
                .foregroundStyle(Palette.dim2)
        }
        .padding(16)
        .heroCard(radius: 20)
    }

    private func capability(_ label: String, on: Bool) -> some View {
        HStack(spacing: 5) {
            Circle().fill(on ? Palette.mint : Palette.dim).frame(width: 7, height: 7)
            Text(label)
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(on ? Palette.text2 : Palette.dim2)
        }
    }

    private var guardrailsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker("Guardrails", color: Palette.lav)
                .padding(.bottom, 12)
            toggleRow("Approve every reply before it sends", "Always on — nothing reaches fans without you",
                      isOn: .constant(true), locked: true)
            Divider().overlay(Palette.line).padding(.vertical, 12)
            toggleRow("Stick to your topics", "Training, mindset, leadership, career and the game",
                      isOn: settingBinding(\.guardTopics, key: "guardTopics"))
            Divider().overlay(Palette.line).padding(.vertical, 12)
            toggleRow("Auto-decline sensitive asks", "Medical, betting and legal questions get a polite pass",
                      isOn: settingBinding(\.guardDecline, key: "guardDecline"))
        }
        .card(padding: 16, radius: 18)
        .disabled(store.settings == nil)
    }

    private var availabilityCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            toggleRow("Pause new questions", "Fans can still listen to everything — they just can't ask for now",
                      isOn: settingBinding(\.paused, key: "paused"))
            if store.settings?.paused == true {
                Text("Fans see: \(app.firstName) is away for a bit — questions reopen soon.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.papaya)
            }
        }
        .card(padding: 16, radius: 18)
        .disabled(store.settings == nil)
    }

    private func toggleRow(_ title: String, _ subtitle: String, isOn: Binding<Bool>, locked: Bool = false) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title).font(.system(size: 14.5, weight: .bold))
                    if locked {
                        Image(systemName: "lock.fill").font(.system(size: 10)).foregroundStyle(Palette.dim2)
                    }
                }
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.dim2)
            }
        }
        .tint(Palette.mint)
        .disabled(locked)
    }

    private func settingBinding(_ keyPath: KeyPath<StudioSettings, Bool>, key: String) -> Binding<Bool> {
        Binding(
            get: { store.settings?[keyPath: keyPath] ?? false },
            set: { value in Task { await store.update([key: value]) } }
        )
    }

    private var bioCard: some View {
        Button {
            editingBio = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "person.wave.2.fill")
                    .font(.system(size: 17))
                    .foregroundStyle(Palette.lav)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Voice bio")
                        .font(.system(size: 15, weight: .bold))
                    Text(store.bio?.isApproved == true ? "Approved — the first thing new fans hear" : "Needs your OK before fans hear it")
                        .font(.system(size: 12))
                        .foregroundStyle(store.bio?.isApproved == true ? Palette.dim2 : Palette.papaya)
                }
                Spacer()
                Text(store.bio?.isApproved == true ? "Edit" : "Review")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Palette.mint)
            }
            .card(padding: 16, radius: 18)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var performanceCard: some View {
        let published = (store.drops?.published ?? []).sorted { ($0.listens ?? 0) > ($1.listens ?? 0) }
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Kicker("Your drops · by listens", color: Palette.lav)
                Spacer()
                Text("pin your best to your profile")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Palette.dim2)
            }
            if published.isEmpty {
                Text("Nothing published yet. Approve a drafted drop on Today and it ships at 7 AM.")
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.sub)
            } else {
                ForEach(published) { drop in
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(drop.title)
                                .font(.system(size: 14, weight: .bold))
                                .lineLimit(1)
                            Text("\(drop.listens ?? 0) listens · \(Format.relative(drop.publishedAt))")
                                .font(.system(size: 11.5))
                                .foregroundStyle(Palette.dim2)
                        }
                        Spacer()
                        Button {
                            Task { await store.setPinned(drop, !(drop.pinned ?? false)) }
                        } label: {
                            Label(drop.pinned == true ? "Pinned" : "Pin", systemImage: drop.pinned == true ? "pin.fill" : "pin")
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundStyle(drop.pinned == true ? Palette.mint : Palette.dim2)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(drop.pinned == true ? Palette.chipBg : .clear))
                                .overlay(Capsule().strokeBorder(drop.pinned == true ? Palette.chipLine : Palette.line2))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .card(padding: 16, radius: 18)
    }

    private var accountCard: some View {
        VStack(spacing: 0) {
            linkRow("Privacy Policy", Links.privacy)
            Divider().overlay(Palette.line)
            linkRow("Terms of Use", Links.terms)
            Divider().overlay(Palette.line)
            linkRow("Help & support", Links.support)
            Divider().overlay(Palette.line)
            Button {
                confirmSignOut = true
            } label: {
                HStack {
                    Text("Sign out").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.red)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("signOut")
        }
        .card(padding: 4, radius: 18)
    }

    private func linkRow(_ title: String, _ url: URL) -> some View {
        Button {
            openURL(url)
        } label: {
            HStack {
                Text(title).font(.system(size: 15, weight: .semibold))
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Palette.dim)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
