import SwiftUI

struct CaptureView: View {
    @Environment(StudioStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var selectedID = CaptureView.dropPromptID
    @State private var recorder = Recorder()
    @State private var take: RecordedTake?
    @State private var transcript = ""
    @State private var transcribing = false
    @State private var dropTitle = ""
    @State private var saving = false
    @State private var pressing = false
    @State private var micDenied = Recorder.permissionDenied

    static let dropPromptID = "drop"

    private var dropPrompt: Prompt {
        Prompt(id: Self.dropPromptID, title: "Record a drop", src: "YOUR CALL · YOU APPROVE BEFORE IT SHIPS",
               hint: "Say what's on your mind — it lands in your drafts, you approve it, and fans hear it in your voice.")
    }

    private var allPrompts: [Prompt] { [dropPrompt] + store.prompts }

    private var selected: Prompt {
        allPrompts.first { $0.id == selectedID } ?? dropPrompt
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Capture")
                        .font(.system(size: 30, weight: .heavy))
                    Text("Teach \(app.athlete?.coach ?? "your Coach") — your stories become answers.")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Palette.dim2)
                }
                .padding(.top, 6)

                promptChips
                promptCard

                if let take {
                    TakeReview(take: take, transcript: $transcript, transcribing: transcribing,
                               isDrop: selected.id == Self.dropPromptID, dropTitle: $dropTitle,
                               saving: saving, onSave: save, onDiscard: discard)
                } else {
                    recorderArea
                }

                if !store.coverage.isEmpty {
                    CoverageCard(coverage: store.coverage)
                }

                if !store.stories.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(title: "Captured", trailing: "\(store.stories.count) so far")
                        ForEach(store.stories) { story in
                            StoryRow(story: story)
                                .contextMenu {
                                    Button("Delete", role: .destructive) {
                                        Task { await store.deleteStory(story) }
                                    }
                                }
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await store.loadPrompts()
            await store.loadStories()
        }
        .onDisappear {
            if recorder.isRecording { recorder.cancel() }
        }
    }

    // MARK: Prompts

    private var promptChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(allPrompts) { prompt in
                    Chip(text: prompt.title, selected: prompt.id == selectedID) {
                        guard take == nil, !recorder.isRecording else { return }
                        selectedID = prompt.id
                    }
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.horizontal, -18)
    }

    private var promptCard: some View {
        VStack(alignment: .leading, spacing: 7) {
            Kicker(selected.src ?? "Starter prompt", color: Palette.lav)
            Text(selected.title)
                .font(.system(size: 19, weight: .heavy))
            if let hint = selected.hint {
                Text(hint)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Palette.sub2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if selected.id != Self.dropPromptID && selected.id != "free" && take == nil {
                Button("Pass — don't ask me this") {
                    let prompt = selected
                    selectedID = Self.dropPromptID
                    Task { await store.pass(prompt) }
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Palette.dim2)
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .heroCard(radius: 20)
    }

    // MARK: Recording

    private var recorderArea: some View {
        VStack(spacing: 10) {
            if micDenied {
                VStack(spacing: 10) {
                    Text("Microphone access is off for Strive.")
                        .font(.system(size: 14, weight: .bold))
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .frame(maxWidth: .infinity)
                .card(padding: 20, radius: 18)
            } else {
                if recorder.isRecording {
                    HStack(spacing: 8) {
                        Circle().fill(Palette.red).frame(width: 8, height: 8)
                        Text("REC \(Format.clock(recorder.elapsed))")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(Palette.red)
                            .monospacedDigit()
                    }
                } else {
                    Text("Hold to talk")
                        .font(.system(size: 12, weight: .heavy))
                        .tracking(1.4)
                        .foregroundStyle(Palette.sub)
                }
                HoldToTalkOrb(isRecording: recorder.isRecording, level: recorder.level,
                              onPress: startRecording, onRelease: stopRecording)
                Text(recorder.isRecording ? "Release to finish" : "30 seconds or three minutes — whatever the story needs.")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.dim2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private func startRecording() {
        pressing = true
        guard !recorder.isRecording, take == nil else { return }
        Task {
            guard await Recorder.requestPermission() else {
                micDenied = true
                return
            }
            // A quick tap can end before permission resolves — never start a recording nobody is holding.
            guard pressing else { return }
            do {
                try recorder.start()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
        }
    }

    private func stopRecording() {
        pressing = false
        guard recorder.isRecording else { return }
        guard let finished = recorder.stop() else {
            ToastCenter.shared.show("Hold a little longer to record.", style: .info)
            return
        }
        take = finished
        transcript = ""
        dropTitle = ""
        transcribing = true
        Task {
            do {
                transcript = try await Transcriber.transcribe(finished.url)
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .info)
            }
            transcribing = false
        }
    }

    // MARK: Save

    private func save() {
        guard let take, !transcript.trimmed.isEmpty else { return }
        saving = true
        let prompt = selected
        Task {
            do {
                if prompt.id == Self.dropPromptID {
                    let title = dropTitle.trimmed.isEmpty ? String(transcript.trimmed.prefix(42)) : dropTitle
                    try await store.createDrop(title: title, script: transcript)
                    ToastCenter.shared.show("In your drafts — approve it on Today")
                } else {
                    try await store.saveStory(promptID: prompt.id, title: prompt.title, transcript: transcript, take: take)
                    ToastCenter.shared.show("Saved — your Coach learns from this")
                    if prompt.id != "free" { selectedID = Self.dropPromptID }
                }
                discard()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            saving = false
        }
    }

    private func discard() {
        if let take {
            if AudioEngine.shared.isCurrent("take:\(take.url.lastPathComponent)") { AudioEngine.shared.stop() }
            try? FileManager.default.removeItem(at: take.url)
        }
        take = nil
        transcript = ""
        dropTitle = ""
    }
}

private struct TakeReview: View {
    let take: RecordedTake
    @Binding var transcript: String
    let transcribing: Bool
    let isDrop: Bool
    @Binding var dropTitle: String
    let saving: Bool
    let onSave: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        let item = PlayableAudio(id: "take:\(take.url.lastPathComponent)", title: "Your take",
                                 subtitle: "Not saved yet", source: .local(take.url), durationHint: take.duration)
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                PlayButton(item: item, size: 40, style: .subtle)
                Waveform(id: item.id, bars: 26, height: 22, color: Palette.lav)
                Spacer(minLength: 0)
                Text(Format.clock(take.duration))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.dim2)
                    .monospacedDigit()
            }
            Kicker(transcribing ? "Transcribing on your iPhone…" : "What we heard — fix anything", color: Palette.lav)
            if transcribing {
                ProgressView().tint(Palette.lav).frame(maxWidth: .infinity).padding(.vertical, 20)
            } else {
                if isDrop {
                    TextField("Title (optional)", text: $dropTitle)
                        .font(.system(size: 15, weight: .bold))
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.card2))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.line2))
                }
                TextEditor(text: $transcript)
                    .font(.system(size: 15))
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 130)
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.card2))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Palette.line2))
                    .accessibilityIdentifier("transcriptEditor")
            }
            HStack(spacing: 10) {
                Button(action: onSave) {
                    ZStack {
                        Text(isDrop ? "Send to drafts" : "Save to your Coach").opacity(saving ? 0 : 1)
                        if saving { ProgressView().tint(Palette.ink) }
                    }
                }
                .buttonStyle(PrimaryButtonStyle(compact: true))
                .disabled(saving || transcribing || transcript.trimmed.isEmpty)
                Button("Discard", action: onDiscard)
                    .buttonStyle(SecondaryButtonStyle(color: Palette.papaya))
                    .disabled(saving)
            }
            Text(isDrop
                 ? "Nothing ships until you approve it on Today."
                 : "Stories stay private — they teach your Coach what you'd say. Fans only hear what you approve.")
                .font(.system(size: 11.5))
                .foregroundStyle(Palette.dim2)
        }
        .card(padding: 16, radius: 20)
    }
}

private struct CoverageCard: View {
    let coverage: [Coverage]

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .firstTextBaseline) {
                Kicker("How much your Coach knows", color: Palette.lav)
                Spacer()
                Text("from what you've approved")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Palette.dim2)
            }
            ForEach(coverage.sorted { $0.pct < $1.pct }) { item in
                HStack(spacing: 10) {
                    Text(item.bucket)
                        .font(.system(size: 12.5, weight: .bold))
                        .frame(width: 86, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.line2)
                            Capsule().fill(item.pct < 30 ? Palette.papaya : Palette.mint)
                                .frame(width: max(4, geo.size.width * min(1, item.pct / 100)))
                        }
                    }
                    .frame(height: 5)
                    Text("\(Int(item.pct.rounded()))%")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(item.pct < 30 ? Palette.papaya : Palette.dim2)
                        .frame(width: 38, alignment: .trailing)
                        .monospacedDigit()
                }
            }
        }
        .card(padding: 16, radius: 18)
    }
}

private struct StoryRow: View {
    let story: Story

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(story.title)
                    .font(.system(size: 14, weight: .bold))
                    .lineLimit(1)
                Spacer()
                Text("\(Format.clock(story.duration)) · \(Format.relative(story.createdAt))")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.dim2)
            }
            if let transcript = story.transcript, !transcript.isEmpty {
                Text(transcript)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Palette.sub)
                    .lineLimit(2)
            }
            Label("In your Coach's knowledge", systemImage: "checkmark")
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Palette.mint)
        }
        .card(padding: 12, radius: 16, fill: Palette.card2)
    }
}
