import SwiftUI

/// Strive's palette — carried over from the web prototype so the brand reads the same on every surface.
enum Palette {
    static let bg = Color(hex: 0x0B0C0B)
    static let card = Color(hex: 0x141715)
    static let card2 = Color(hex: 0x161917)
    static let raised = Color(hex: 0x1A201B)
    static let line = Color(hex: 0x1F241F)
    static let line2 = Color(hex: 0x232823)
    static let text = Color(hex: 0xF3F5F3)
    static let text2 = Color(hex: 0xD7DDD8)
    static let heading = Color(hex: 0xB9C0BA)
    static let sub = Color(hex: 0x8B938D)
    static let sub2 = Color(hex: 0x9BA39D)
    static let dim = Color(hex: 0x5C635D)
    static let dim2 = Color(hex: 0x7C837D)
    static let mint = Color(hex: 0x7CE2A5)
    static let mintDeep = Color(hex: 0x3E7A57)
    static let lav = Color(hex: 0xCBA9F7)
    static let azure = Color(hex: 0x7EB3F7)
    static let papaya = Color(hex: 0xFCA46F)
    static let red = Color(hex: 0xF08A8A)
    static let ink = Color(hex: 0x0B0C0B)
    static let chipLine = Color(hex: 0x2E3A31)
    static let chipBg = Color(hex: 0x18201A)
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}

// MARK: - Surfaces

extension View {
    func card(padding: CGFloat = 16, radius: CGFloat = 18, fill: Color = Palette.card, stroke: Color = Palette.line) -> some View {
        self
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(stroke, lineWidth: 1))
    }

    /// The raised gradient treatment used for hero cards.
    func heroCard(radius: CGFloat = 22) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(LinearGradient(colors: [Palette.raised, Palette.card], startPoint: .topLeading, endPoint: .bottomTrailing))
            )
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color(hex: 0x273029), lineWidth: 1))
    }
}

// MARK: - Type

struct Kicker: View {
    let text: String
    var color: Color = Palette.mint

    init(_ text: String, color: Color = Palette.mint) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .heavy))
            .tracking(1.5)
            .foregroundStyle(color)
    }
}

struct SectionHeader: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Palette.heading)
            Spacer(minLength: 8)
            if let trailing {
                Text(trailing)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Palette.dim2)
                    .lineLimit(1)
            }
        }
    }
}

struct Wordmark: View {
    var size: CGFloat = 30

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: size * 0.25) {
            Text("STRIVE")
                .font(.system(size: size, weight: .black))
                .tracking(size * 0.2)
                .foregroundStyle(Palette.text)
            Rectangle()
                .fill(Palette.mint)
                .frame(width: size * 0.36, height: size * 0.36)
        }
        .accessibilityElement()
        .accessibilityLabel("Strive")
    }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = Palette.mint
    var fullWidth = true
    var compact = false
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 13.5 : 16, weight: .bold))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, compact ? 10 : 15)
            .padding(.horizontal, compact ? 16 : 20)
            .background(
                RoundedRectangle(cornerRadius: compact ? 12 : 14, style: .continuous)
                    .fill(isEnabled ? color : Palette.dim)
                    .opacity(configuration.isPressed ? 0.8 : 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var color: Color = Palette.mint
    var fullWidth = false
    var compact = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 13.5 : 16, weight: .bold))
            .foregroundStyle(color)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, compact ? 10 : 15)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: compact ? 12 : 14, style: .continuous)
                    .fill(Palette.chipBg.opacity(configuration.isPressed ? 1 : 0.001))
            )
            .overlay(
                RoundedRectangle(cornerRadius: compact ? 12 : 14, style: .continuous)
                    .strokeBorder(Palette.chipLine, lineWidth: 1)
            )
    }
}

// MARK: - Formatting

enum Format {
    static func clock(_ seconds: Double?) -> String {
        guard let seconds, seconds.isFinite, seconds > 0 else { return "0:00" }
        let s = Int(seconds.rounded())
        return "\(s / 60):" + String(format: "%02d", s % 60)
    }

    static func date(_ ms: Int64?) -> Date? {
        guard let ms else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(ms) / 1000)
    }

    static func relative(_ ms: Int64?) -> String {
        guard let date = date(ms) else { return "" }
        if Date().timeIntervalSince(date) < 60 { return "just now" }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }

    static func greeting(now: Date = Date()) -> String {
        switch Calendar.current.component(.hour, from: now) {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        default: return "Good evening"
        }
    }

    static func today() -> String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    static func hours(_ h: Double?) -> String {
        guard let h, h.isFinite else { return "—" }
        if h < 1 { return "\(max(1, Int((h * 60).rounded())))m" }
        if h < 48 { return "\(Int(h.rounded()))h" }
        return "\(Int((h / 24).rounded()))d"
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
