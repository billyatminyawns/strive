import SwiftUI
import Observation

@MainActor
@Observable
final class ToastCenter {
    static let shared = ToastCenter()

    enum Style { case success, info, error }

    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let text: String
        let style: Style
    }

    private(set) var current: Toast?

    func show(_ text: String, style: Style = .success) {
        let toast = Toast(text: text, style: style)
        withAnimation(.spring(duration: 0.35)) { current = toast }
        Task {
            try? await Task.sleep(for: .seconds(style == .error ? 3.6 : 2.6))
            if current?.id == toast.id { dismiss() }
        }
    }

    func dismiss() {
        withAnimation(.easeOut(duration: 0.25)) { current = nil }
    }
}

struct ToastOverlay: View {
    @Environment(ToastCenter.self) private var center

    var body: some View {
        VStack {
            if let toast = center.current {
                HStack(spacing: 10) {
                    Image(systemName: icon(toast.style))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(tint(toast.style))
                    Text(toast.text)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Palette.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Capsule().fill(Color(hex: 0x1C221D)))
                .overlay(Capsule().strokeBorder(tint(toast.style).opacity(0.35), lineWidth: 1))
                .shadow(color: .black.opacity(0.4), radius: 18, y: 8)
                .padding(.horizontal, 20)
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("toast")
                .onTapGesture { center.dismiss() }
            }
            Spacer()
        }
        .padding(.top, 6)
        .allowsHitTesting(center.current != nil)
    }

    private func icon(_ style: ToastCenter.Style) -> String {
        switch style {
        case .success: return "checkmark.circle.fill"
        case .info: return "info.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        }
    }

    private func tint(_ style: ToastCenter.Style) -> Color {
        switch style {
        case .success: return Palette.mint
        case .info: return Palette.azure
        case .error: return Palette.papaya
        }
    }
}
