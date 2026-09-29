import SwiftUI

struct AskView: View {
    @Environment(FanStore.self) private var store
    @Environment(AppState.self) private var app
    @State private var draft = ""
    @State private var sending = false
    @FocusState private var inputFocused: Bool
    @AppStorage("strive.askedOnce") private var askedOnce = false

    private var canSend: Bool {
        !draft.trimmed.isEmpty && !sending && !store.paused && draft.count <= 300
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    IntroBubble(athlete: store.athlete)
                    ForEach(store.questions) { question in
                        QuestionExchange(question: question)
                            .id(question.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: store.questions.count) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("bottom", anchor: .bottom) }
            }
            .onChange(of: inputFocused) { _, focused in
                if focused {
                    withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("bottom", anchor: .bottom) }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .background(Palette.bg)
        .navigationTitle("Ask \(app.firstName)")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.loadQuestions() }
        .task {
            await store.loadQuestions()
            if store.home == nil { await store.loadHome() }
            await pollWhilePending()
        }
    }

    /// While something is waiting on the athlete, check back every so often.
    private func pollWhilePending() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(12))
            guard !Task.isCancelled else { return }
            if store.questions.contains(where: { $0.status == .pending }) {
                await store.loadQuestions()
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 10) {
            if store.paused {
                HStack(spacing: 8) {
                    Image(systemName: "moon.zzz.fill").foregroundStyle(Palette.papaya)
                    Text("\(app.firstName) is away for a bit — questions reopen soon. Everything she's shared is still here.")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Palette.sub2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .card(padding: 12, radius: 14, fill: Palette.card2)
                .padding(.horizontal, 12)
            } else if !store.suggestions.isEmpty && store.questions.count < 8 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.suggestions, id: \.self) { suggestion in
                            Button {
                                send(suggestion)
                            } label: {
                                Text(suggestion)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Palette.mint)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 9)
                                    .background(Capsule().fill(Palette.chipBg))
                                    .overlay(Capsule().strokeBorder(Palette.chipLine))
                            }
                            .buttonStyle(.plain)
                            .disabled(sending)
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .accessibilityIdentifier("suggestions")
            }

            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask \(app.firstName) anything…", text: $draft, axis: .vertical)
                    .font(.system(size: 16))
                    .lineLimit(1...5)
                    .focused($inputFocused)
                    .disabled(store.paused)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Palette.card))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Palette.line2))
                    .accessibilityIdentifier("askField")
                Button {
                    send(draft)
                } label: {
                    ZStack {
                        Circle().fill(canSend ? Palette.mint : Palette.card)
                        if sending {
                            ProgressView().tint(Palette.ink)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(canSend ? Palette.ink : Palette.dim)
                        }
                    }
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityLabel("Send question")
                .accessibilityIdentifier("askSend")
            }
            .padding(.horizontal, 12)

            if draft.count > 240 {
                Text("\(300 - draft.count) characters left")
                    .font(.system(size: 11))
                    .foregroundStyle(draft.count > 300 ? Palette.papaya : Palette.dim2)
            }
        }
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(Palette.bg.opacity(0.97))
        .overlay(alignment: .top) { Rectangle().fill(Palette.line).frame(height: 1) }
    }

    private func send(_ text: String) {
        let question = text.trimmed
        guard !question.isEmpty, !sending, !store.paused else { return }
        sending = true
        draft = ""
        Task {
            do {
                try await store.ask(question)
                if !askedOnce {
                    askedOnce = true
                    await PushRegistrar.requestAndRegister()
                }
            } catch {
                draft = question
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            sending = false
        }
    }
}

private struct IntroBubble: View {
    let athlete: Athlete?

    var body: some View {
        let first = athlete?.firstName ?? "Angela"
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                AthleteAvatar(athlete: athlete, size: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(athlete?.coach ?? "Coach Angela")
                        .font(.system(size: 14, weight: .heavy))
                    Text("Trained on \(first)'s own words")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Palette.dim2)
                }
            }
            Text("Ask anything about training, mindset, leadership, or the game. \(first) reviews every reply before it's sent — and answers she's already approved come back instantly, in her voice.")
                .font(.system(size: 14))
                .foregroundStyle(Palette.sub2)
                .lineSpacing(2)
        }
        .card(padding: 14, radius: 18, fill: Palette.card2)
        .padding(.trailing, 30)
    }
}

struct QuestionExchange: View {
    let question: Question

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Spacer(minLength: 56)
                Text(question.text)
                    .font(.system(size: 15))
                    .foregroundStyle(Palette.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Palette.mintDeep.opacity(0.42)))
                    .accessibilityIdentifier("myQuestion")
            }
            switch question.status {
            case .pending:
                NoteBubble(icon: "clock.fill", tint: Palette.azure,
                           text: question.note ?? "With Angela — she reviews every answer before it's sent.")
                    .accessibilityIdentifier("pendingNote")
            case .answered, .instant:
                VoiceReplyCard(question: question)
            case .guarded, .declined:
                NoteBubble(icon: "hand.raised.fill", tint: Palette.papaya,
                           text: question.note ?? "Angela passed on this one.")
                    .accessibilityIdentifier("guardNote")
            case .unknown:
                EmptyView()
            }
        }
    }
}

private struct NoteBubble: View {
    let icon: String
    let tint: Color
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(tint)
                .padding(.top, 1)
            Text(text)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.sub2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .card(padding: 12, radius: 16, fill: Palette.card2)
        .padding(.trailing, 50)
        .accessibilityElement(children: .combine)
    }
}

struct VoiceReplyCard: View {
    @Environment(FanStore.self) private var store
    @Environment(AppState.self) private var app
    let question: Question
    var compact = false
    @State private var showWords = false

    var body: some View {
        let first = app.firstName
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                AthleteAvatar(athlete: store.athlete, size: 26)
                Text(first)
                    .font(.system(size: 14, weight: .heavy))
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mint)
                if question.status == .instant {
                    Text("INSTANT")
                        .font(.system(size: 9.5, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(Palette.lav)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .overlay(Capsule().strokeBorder(Palette.lav.opacity(0.4)))
                }
                Spacer(minLength: 0)
                Button {
                    Task { await store.setSaved(question, !(question.saved ?? false)) }
                } label: {
                    Image(systemName: question.saved == true ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(question.saved == true ? Palette.mint : Palette.dim2)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(question.saved == true ? "Remove from Library" : "Save to Library")
            }

            if compact {
                Text(question.text)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Palette.text2)
                    .lineLimit(2)
            }

            if let item = PlayableAudio.reply(question, athlete: store.athlete) {
                HStack(spacing: 12) {
                    PlayButton(item: item, size: 42)
                        .accessibilityIdentifier("playReply")
                    Waveform(id: item.id, bars: 26, height: 24)
                    Spacer(minLength: 0)
                    Text(Format.clock(question.duration))
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Palette.dim2)
                        .monospacedDigit()
                }
            }

            if let answer = question.answer {
                Button(showWords ? "Hide words" : "Read along") {
                    withAnimation(.easeInOut(duration: 0.2)) { showWords.toggle() }
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Palette.dim2)
                if showWords {
                    Text(answer)
                        .font(.system(size: 14.5))
                        .foregroundStyle(Palette.sub2)
                        .lineSpacing(3)
                        .textSelection(.enabled)
                }
            }

            VoiceDisclosure(firstName: first)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(LinearGradient(colors: [Palette.raised, Palette.card], startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color(hex: 0x273029)))
        .padding(.trailing, compact ? 0 : 36)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("voiceReply")
    }
}
