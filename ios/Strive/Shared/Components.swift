import SwiftUI

// MARK: - Links

enum Links {
    static let site = URL(string: "https://billyatminyawns.github.io/strive/")!
    static let privacy = URL(string: "https://billyatminyawns.github.io/strive/privacy.html")!
    static let terms = URL(string: "https://billyatminyawns.github.io/strive/terms.html")!
    static let support = URL(string: "https://billyatminyawns.github.io/strive/support.html")!
}

struct LegalLinks: View {
    var body: some View {
        HStack(spacing: 14) {
            Link("Privacy", destination: Links.privacy)
            Text("·").foregroundStyle(Palette.dim)
            Link("Terms", destination: Links.terms)
            Text("·").foregroundStyle(Palette.dim)
            Link("Support", destination: Links.support)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Palette.dim2)
    }
}

// MARK: - Athlete imagery

/// Bundled photos for the pilot athlete, remote photos for anyone else.
struct AthleteImage: View {
    enum Kind { case head, hero, action }

    let athlete: Athlete?
    let kind: Kind

    var body: some View {
        if let bundled {
            Image(bundled).resizable().scaledToFill()
        } else if let remote {
            AsyncImage(url: remote) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    Palette.card2
                }
            }
        } else {
            Palette.card2
        }
    }

    private var bundled: String? {
        guard athlete?.id.hasPrefix("angela") ?? true else { return nil }
        switch kind {
        case .head: return "AngelaHead"
        case .hero: return "AngelaHero"
        case .action: return "AngelaAction"
        }
    }

    private var remote: URL? {
        kind == .head ? athlete?.photoURL : (athlete?.heroURL ?? athlete?.photoURL)
    }
}

struct AthleteAvatar: View {
    let athlete: Athlete?
    var size: CGFloat = 40

    var body: some View {
        AthleteImage(athlete: athlete, kind: .head)
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Palette.line2, lineWidth: 1))
            .accessibilityHidden(true)
    }
}

struct InitialAvatar: View {
    let name: String?
    var size: CGFloat = 40
    var color: Color = Palette.lav

    var body: some View {
        Text((name?.trimmed.first.map { String($0) } ?? "?").uppercased())
            .font(.system(size: size * 0.42, weight: .heavy))
            .foregroundStyle(Palette.ink)
            .frame(width: size, height: size)
            .background(Circle().fill(color))
            .accessibilityHidden(true)
    }
}

/// "Approved by Angela · AI voice" — shown wherever her voice plays, so fans always know what they're hearing.
struct VoiceDisclosure: View {
    let firstName: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "checkmark.seal.fill").foregroundStyle(Palette.mint)
            Text("Approved by \(firstName) · AI voice")
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(Palette.dim2)
    }
}

// MARK: - Playback

struct PlayButton: View {
    enum Style { case filled, subtle }

    @Environment(AudioEngine.self) private var audio
    let item: PlayableAudio
    var size: CGFloat = 44
    var style: Style = .filled

    var body: some View {
        let playing = audio.isPlaying(item.id)
        Button {
            audio.toggle(item)
        } label: {
            ZStack {
                Circle().fill(style == .filled ? Palette.mint : Palette.chipBg)
                if audio.isLoading(item.id) {
                    ProgressView()
                        .tint(style == .filled ? Palette.ink : Palette.mint)
                } else {
                    Image(systemName: playing ? "pause.fill" : "play.fill")
                        .font(.system(size: size * 0.34, weight: .bold))
                        .foregroundStyle(style == .filled ? Palette.ink : Palette.mint)
                        .offset(x: playing ? 0 : size * 0.03)
                }
            }
            .frame(width: size, height: size)
            .overlay(Circle().strokeBorder(style == .filled ? Color.clear : Palette.chipLine, lineWidth: 1))
            .shadow(color: style == .filled ? Palette.mint.opacity(0.25) : .clear, radius: size * 0.2, y: size * 0.1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(playing ? "Pause" : "Play \(item.title)")
    }
}

struct Waveform: View {
    @Environment(AudioEngine.self) private var audio
    let id: String
    var bars: Int = 28
    var height: CGFloat = 22
    var color: Color = Palette.mint

    var body: some View {
        let progress = audio.progress(id)
        let heights = Self.heights(seed: id, count: bars)
        HStack(alignment: .center, spacing: 2) {
            ForEach(0..<bars, id: \.self) { index in
                Capsule()
                    .fill(Double(index) / Double(bars) < progress ? color : color.opacity(0.28))
                    .frame(width: 2.5, height: max(3, heights[index] * height))
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    static func heights(seed: String, count: Int) -> [CGFloat] {
        var h: UInt64 = 5381
        for byte in seed.utf8 { h = (h &* 33) &+ UInt64(byte) }
        return (0..<count).map { i in
            h = h &* 6364136223846793005 &+ 1442695040888963407
            let noise = Double((h >> 33) % 1000) / 1000
            let envelope = 0.55 + 0.45 * sin(Double(i) / Double(max(count - 1, 1)) * .pi)
            return CGFloat(0.25 + 0.75 * noise * envelope)
        }
    }
}

// MARK: - Chips & layout

struct Chip: View {
    let text: String
    var selected = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(selected ? Palette.ink : Palette.text2)
                .padding(.horizontal, 15)
                .padding(.vertical, 9)
                .background(Capsule().fill(selected ? Palette.mint : Palette.chipBg))
                .overlay(Capsule().strokeBorder(selected ? Palette.mint : Palette.chipLine, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Wrapping row layout for chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8
    var centered = false

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + lineSpacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = centered ? bounds.minX + (bounds.width - row.width) / 2 : bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            if needed > width, !row.indices.isEmpty {
                rows.append(row)
                row = Row()
            }
            row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
        }
        if !row.indices.isEmpty { rows.append(row) }
        return rows
    }
}

// MARK: - States

struct EmptyStateCard: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(Palette.mint)
                .frame(width: 56, height: 56)
                .background(Circle().fill(Palette.chipBg))
                .overlay(Circle().strokeBorder(Palette.chipLine))
            Text(title)
                .font(.system(size: 17, weight: .heavy))
                .multilineTextAlignment(.center)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.sub)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(SecondaryButtonStyle())
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .card(padding: 22, radius: 20)
    }
}

struct ErrorCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Palette.papaya)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Palette.sub2)
                .multilineTextAlignment(.center)
            Button("Try again", action: retry)
                .buttonStyle(SecondaryButtonStyle())
        }
        .frame(maxWidth: .infinity)
        .card(padding: 22, radius: 20)
    }
}

// MARK: - Hold to talk

/// Press-and-hold mic orb. Release (or a cancelled gesture) always ends the recording.
struct HoldToTalkOrb: View {
    let isRecording: Bool
    let level: Double
    var size: CGFloat = 104
    let onPress: () -> Void
    let onRelease: () -> Void

    @GestureState private var pressing = false

    var body: some View {
        ZStack {
            Circle()
                .fill((isRecording ? Palette.red : Palette.mint).opacity(0.16))
                .frame(width: size * (1.28 + level * 0.35), height: size * (1.28 + level * 0.35))
                .animation(.easeOut(duration: 0.12), value: level)
            Circle()
                .fill(isRecording ? Palette.red : Palette.mint)
                .frame(width: size, height: size)
                .shadow(color: (isRecording ? Palette.red : Palette.mint).opacity(0.35), radius: 22, y: 10)
            Image(systemName: isRecording ? "waveform" : "mic.fill")
                .font(.system(size: size * 0.32, weight: .bold))
                .foregroundStyle(Palette.ink)
        }
        .frame(width: size * 1.7, height: size * 1.7)
        .contentShape(Circle())
        .scaleEffect(pressing ? 0.96 : 1)
        .gesture(
            DragGesture(minimumDistance: 0)
                .updating($pressing) { _, state, _ in state = true }
        )
        .onChange(of: pressing) { _, isPressed in
            isPressed ? onPress() : onRelease()
        }
        .accessibilityElement()
        .accessibilityLabel(isRecording ? "Recording. Release to stop." : "Hold to record")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("holdToTalk")
    }
}
