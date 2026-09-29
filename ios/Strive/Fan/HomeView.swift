import SwiftUI

struct HomeView: View {
    @Environment(FanStore.self) private var store
    @Environment(AppState.self) private var app
    @State private var showNotifications = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                if let home = store.home {
                    content(home)
                } else if let error = store.homeError {
                    ErrorCard(message: error) { Task { await store.loadHome() } }
                } else {
                    ProgressView()
                        .tint(Palette.mint)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 90)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(Palette.bg)
        .refreshable { await store.loadHome() }
        .task { await store.loadHome() }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(isPresented: $showNotifications) { NotificationsView() }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(greeting)
                    .font(.system(size: 26, weight: .heavy))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(Format.today())
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.dim2)
            }
            Spacer()
            Button {
                showNotifications = true
            } label: {
                Image(systemName: "bell.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Palette.text2)
                    .frame(width: 42, height: 42)
                    .background(Circle().fill(Palette.card))
                    .overlay(Circle().strokeBorder(Palette.line2))
                    .overlay(alignment: .topTrailing) {
                        if store.unread > 0 {
                            Circle().fill(Palette.mint)
                                .frame(width: 11, height: 11)
                                .overlay(Circle().strokeBorder(Palette.bg, lineWidth: 2))
                                .offset(x: -1, y: 1)
                        }
                    }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(store.unread > 0 ? "Notifications, \(store.unread) unread" : "Notifications")
            .accessibilityIdentifier("bell")
        }
        .padding(.top, 6)
    }

    private var greeting: String {
        if let name = app.user?.name, !name.isEmpty { return "\(Format.greeting()), \(name)" }
        return Format.greeting()
    }

    @ViewBuilder
    private func content(_ home: HomeResponse) -> some View {
        let athlete = home.athlete

        if let today = home.today {
            TodayDropCard(drop: today, athlete: athlete)
        }

        if let bio = athlete.bio {
            BioCard(athlete: athlete, bio: bio)
        }

        if !home.picks.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "\(athlete.firstName)'s picks", trailing: "pinned by her")
                ForEach(home.picks) { drop in
                    DropRow(drop: drop, athlete: athlete, badge: "PINNED")
                }
            }
        }

        if !home.suggested.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Suggested for you", trailing: "things you didn't know to ask")
                ForEach(home.suggested) { drop in
                    DropRow(drop: drop, athlete: athlete)
                }
            }
        }

        if home.today == nil && home.picks.isEmpty && home.suggested.isEmpty {
            EmptyStateCard(icon: "waveform",
                           title: "\(athlete.firstName)'s first drops are on the way",
                           message: "She approves every one before it reaches you. In the meantime, ask her anything.",
                           actionTitle: "Ask \(athlete.firstName)") { store.tab = .ask }
        }

        AskPromptCard(athlete: athlete) { store.tab = .ask }
    }
}

struct TodayDropCard: View {
    let drop: Drop
    let athlete: Athlete

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                AthleteImage(athlete: athlete, kind: .hero)
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .overlay(alignment: .top) {
                        LinearGradient(colors: [.black.opacity(0.35), .clear], startPoint: .top, endPoint: .center)
                    }
                LinearGradient(colors: [.clear, Palette.raised.opacity(0.85), Palette.raised],
                               startPoint: .top, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 6) {
                    Kicker(drop.listened == true ? "Today's drop · played" : "Today's drop")
                    Text(drop.title)
                        .font(.system(size: 25, weight: .heavy))
                        .lineLimit(2)
                        .accessibilityIdentifier("todayDropTitle")
                }
                .padding(18)
            }
            .frame(height: 200)

            if let item = PlayableAudio.drop(drop, athlete: athlete) {
                HStack(spacing: 14) {
                    PlayButton(item: item, size: 54)
                        .accessibilityIdentifier("playToday")
                    VStack(alignment: .leading, spacing: 6) {
                        Waveform(id: item.id, bars: 30, height: 26)
                        VoiceDisclosure(firstName: athlete.firstName)
                    }
                    Spacer(minLength: 0)
                    Text(Format.clock(drop.duration))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Palette.dim2)
                        .monospacedDigit()
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
            }
        }
        .heroCard()
    }
}

struct BioCard: View {
    let athlete: Athlete
    let bio: Athlete.Bio
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("Who is \(athlete.firstName) · in her own voice")
            HStack(spacing: 12) {
                AthleteAvatar(athlete: athlete, size: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text(athlete.name)
                        .font(.system(size: 16, weight: .heavy))
                    if let headline = athlete.headline {
                        Text(headline)
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.dim2)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if let item = PlayableAudio.bio(bio, athlete: athlete) {
                    PlayButton(item: item, size: 42)
                        .accessibilityIdentifier("playBio")
                }
            }
            if let badges = athlete.badges, !badges.isEmpty {
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    ForEach(badges, id: \.self) { badge in
                        Text(badge)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Palette.text2)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Palette.chipBg))
                            .overlay(Capsule().strokeBorder(Palette.chipLine))
                    }
                }
            }
            Text(bio.text)
                .font(.system(size: 14))
                .foregroundStyle(Palette.sub2)
                .lineSpacing(3)
                .lineLimit(expanded ? nil : 3)
            Button(expanded ? "Show less" : "Read all") {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            }
            .font(.system(size: 12.5, weight: .bold))
            .foregroundStyle(Palette.mint)
        }
        .card(padding: 16, radius: 20)
    }
}

struct DropRow: View {
    let drop: Drop
    let athlete: Athlete?
    var badge: String?

    var body: some View {
        let item = PlayableAudio.drop(drop, athlete: athlete)
        HStack(spacing: 12) {
            if let item {
                PlayButton(item: item, size: 40, style: .subtle)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(drop.title)
                    .font(.system(size: 15, weight: .bold))
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(Format.clock(drop.duration)).monospacedDigit()
                    if drop.listened == true {
                        Text("·")
                        Label("Played", systemImage: "checkmark")
                            .labelStyle(.titleAndIcon)
                            .foregroundStyle(Palette.mint)
                    }
                }
                .font(.system(size: 12))
                .foregroundStyle(Palette.dim2)
            }
            Spacer(minLength: 8)
            if let badge {
                Text(badge)
                    .font(.system(size: 9.5, weight: .heavy))
                    .tracking(0.8)
                    .foregroundStyle(Palette.mint)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .overlay(Capsule().strokeBorder(Palette.chipLine))
            } else if let item {
                Waveform(id: item.id, bars: 12, height: 16, color: Palette.mint)
                    .frame(width: 60)
            }
        }
        .card(padding: 12, radius: 16, fill: Palette.card2)
    }
}

struct AskPromptCard: View {
    let athlete: Athlete
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Palette.mint)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Palette.chipBg))
                VStack(alignment: .leading, spacing: 3) {
                    Text("Got a question for \(athlete.firstName)?")
                        .font(.system(size: 15, weight: .heavy))
                    Text("She reviews every answer and replies in her voice.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Palette.dim2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Palette.dim)
            }
            .card(padding: 14, radius: 18)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("askPrompt")
    }
}
