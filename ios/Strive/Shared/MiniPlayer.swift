import SwiftUI

extension View {
    /// Pins the now-playing bar above the tab bar on every tab.
    func withMiniPlayer() -> some View {
        safeAreaInset(edge: .bottom, spacing: 0) { MiniPlayerBar() }
    }
}

struct MiniPlayerBar: View {
    @Environment(AudioEngine.self) private var audio
    @Environment(AppState.self) private var app
    @State private var showFull = false

    var body: some View {
        if let item = audio.current {
            HStack(spacing: 12) {
                AthleteAvatar(athlete: app.athlete, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 13.5, weight: .bold))
                        .lineLimit(1)
                    Text("\(Format.clock(audio.currentTime)) / \(Format.clock(audio.duration)) · \(item.subtitle)")
                        .font(.system(size: 11))
                        .foregroundStyle(Palette.dim2)
                        .lineLimit(1)
                        .monospacedDigit()
                }
                Spacer(minLength: 6)
                PlayButton(item: item, size: 36)
                Button {
                    audio.stop()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Palette.dim2)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close player")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(Color(hex: 0x151915))
            .overlay(alignment: .top) {
                GeometryReader { geo in
                    Rectangle()
                        .fill(Palette.mint)
                        .frame(width: geo.size.width * audio.progress(item.id), height: 2)
                }
                .frame(height: 2)
            }
            .overlay(alignment: .top) { Rectangle().fill(Palette.line2).frame(height: 1).offset(y: -1) }
            .contentShape(Rectangle())
            .onTapGesture { showFull = true }
            .sheet(isPresented: $showFull) { FullPlayerView() }
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("miniPlayer")
        }
    }
}

struct FullPlayerView: View {
    @Environment(AudioEngine.self) private var audio
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var scrubbing: Double?

    var body: some View {
        VStack(spacing: 0) {
            Capsule().fill(Palette.line2).frame(width: 38, height: 5).padding(.top, 10)
            if let item = audio.current {
                ScrollView {
                    VStack(spacing: 22) {
                        AthleteImage(athlete: app.athlete, kind: .hero)
                            .frame(width: 250, height: 250)
                            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                            .shadow(color: .black.opacity(0.5), radius: 30, y: 16)
                            .padding(.top, 26)

                        VStack(spacing: 6) {
                            Text(item.title)
                                .font(.system(size: 22, weight: .heavy))
                                .multilineTextAlignment(.center)
                            Text(item.subtitle)
                                .font(.system(size: 14))
                                .foregroundStyle(Palette.sub)
                            VoiceDisclosure(firstName: app.firstName).padding(.top, 2)
                        }
                        .padding(.horizontal, 24)

                        VStack(spacing: 6) {
                            Slider(value: Binding(get: { scrubbing ?? audio.currentTime },
                                                  set: { scrubbing = $0 }),
                                   in: 0...max(audio.duration, 0.1)) { editing in
                                if !editing, let target = scrubbing {
                                    audio.seek(to: target)
                                    scrubbing = nil
                                }
                            }
                            .tint(Palette.mint)
                            HStack {
                                Text(Format.clock(scrubbing ?? audio.currentTime))
                                Spacer()
                                Text("-" + Format.clock(max(0, audio.duration - (scrubbing ?? audio.currentTime))))
                            }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Palette.dim2)
                            .monospacedDigit()
                        }
                        .padding(.horizontal, 28)

                        HStack(spacing: 44) {
                            Button { audio.skip(-15) } label: {
                                Image(systemName: "gobackward.15").font(.system(size: 26, weight: .semibold))
                            }
                            .accessibilityLabel("Back 15 seconds")
                            PlayButton(item: item, size: 76)
                            Button { audio.skip(15) } label: {
                                Image(systemName: "goforward.15").font(.system(size: 26, weight: .semibold))
                            }
                            .accessibilityLabel("Forward 15 seconds")
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(Palette.text)

                        if let transcript = item.transcript, !transcript.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Kicker("Read along", color: Palette.dim2)
                                Text(transcript)
                                    .font(.system(size: 16))
                                    .foregroundStyle(Palette.sub2)
                                    .lineSpacing(4)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card(padding: 18, radius: 18)
                            .padding(.horizontal, 20)
                        }
                    }
                    .padding(.bottom, 30)
                }
            } else {
                Spacer()
                Text("Nothing playing").foregroundStyle(Palette.sub)
                Spacer()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bg)
        .presentationDragIndicator(.hidden)
        .onChange(of: audio.current == nil) { _, isEmpty in
            if isEmpty { dismiss() }
        }
    }
}
