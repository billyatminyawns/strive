import SwiftUI

struct ApproveView: View {
    @Environment(StudioStore.self) private var store
    @State private var editing: StudioQuestion?
    @State private var dragX: CGFloat = 0
    @State private var working: StudioQuestion?
    @State private var successTick = 0
    @State private var failure: String?

    private let threshold: CGFloat = 110

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("Approve")
                    .font(.system(size: 30, weight: .heavy))
                Spacer()
                if !store.queue.isEmpty {
                    Text("\(store.queue.count) waiting")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Palette.dim2)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 12)

            if !store.queueLoaded {
                Spacer()
                ProgressView().tint(Palette.lav)
                Spacer()
            } else if store.queue.isEmpty {
                queueClear
            } else {
                deck
                controls
            }
        }
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.loadQueue() }
        .sheet(item: $editing) { question in
            EditReplyView(question: question)
        }
        .overlay {
            if let working {
                VoicingOverlay(isStarter: working.isStarter)
            }
        }
        .sensoryFeedback(.success, trigger: successTick)
        .alert("Couldn't send that", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(failure ?? "")
        }
    }

    // MARK: Deck

    private var deck: some View {
        let visible = Array(store.queue.prefix(3).enumerated())
        return ZStack {
            ForEach(visible.reversed(), id: \.element.id) { index, question in
                QuestionCard(question: question, isTop: index == 0, dragX: index == 0 ? dragX : 0)
                    .scaleEffect(index == 0 ? 1 : 1 - CGFloat(index) * 0.045)
                    .offset(x: index == 0 ? dragX : 0, y: index == 0 ? 0 : CGFloat(index) * 16)
                    .rotationEffect(.degrees(index == 0 ? Double(dragX / 18) : 0))
                    .opacity(index > 1 ? 0.5 : 1)
                    .allowsHitTesting(index == 0 && working == nil)
                    .gesture(dragGesture(for: question))
                    .zIndex(Double(10 - index))
            }
        }
        .padding(.horizontal, 18)
        .frame(maxHeight: .infinity)
    }

    private func dragGesture(for question: StudioQuestion) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in dragX = value.translation.width }
            .onEnded { value in
                if value.translation.width > threshold {
                    approve(question)
                } else if value.translation.width < -threshold {
                    decline(question)
                } else {
                    withAnimation(.spring(duration: 0.35)) { dragX = 0 }
                }
            }
    }

    private var controls: some View {
        let top = store.queue.first
        return HStack(alignment: .top, spacing: 30) {
            control(icon: "xmark", label: "Delete", id: "declineButton", tint: Palette.papaya, size: 58) {
                if let top { decline(top) }
            }
            control(icon: "pencil", label: "Edit", id: "editButton", tint: Palette.text2, size: 58) {
                editing = top
            }
            control(icon: "checkmark", label: "Approve", id: "approveButton", tint: Palette.ink, fill: Palette.mint, size: 70) {
                if let top { approve(top) }
            }
        }
        .disabled(working != nil)
        .padding(.top, 14)
        .padding(.bottom, 16)
    }

    private func control(icon: String, label: String, id: String, tint: Color, fill: Color? = nil, size: CGFloat,
                         action: @escaping () -> Void) -> some View {
        VStack(spacing: 6) {
            Button(action: action) {
                Image(systemName: icon)
                    .font(.system(size: size * 0.34, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: size, height: size)
                    .background(Circle().fill(fill ?? Palette.card))
                    .overlay(Circle().strokeBorder(fill == nil ? Palette.line2 : .clear, lineWidth: 1.5))
                    .shadow(color: (fill ?? .clear).opacity(0.3), radius: 14, y: 6)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
            .accessibilityIdentifier(id)
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Palette.dim2)
        }
    }

    private var queueClear: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 40))
                .foregroundStyle(Palette.mint)
                .frame(width: 90, height: 90)
                .background(Circle().fill(Palette.chipBg))
                .overlay(Circle().strokeBorder(Palette.chipLine, lineWidth: 1.5))
            Text("Queue clear")
                .font(.system(size: 24, weight: .heavy))
            Text("Every question that needed you is handled. New ones land here the moment fans ask.")
                .font(.system(size: 14))
                .foregroundStyle(Palette.sub)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Capture a story instead") { store.tab = .capture }
                .buttonStyle(SecondaryButtonStyle())
                .padding(.top, 6)
            Spacer()
        }
        .accessibilityIdentifier("queueClear")
    }

    // MARK: Decisions

    private func approve(_ question: StudioQuestion) {
        guard working == nil else { return }
        guard question.hasDraft else {
            withAnimation(.spring(duration: 0.35)) { dragX = 0 }
            ToastCenter.shared.show("Add your words first — then approve.", style: .info)
            editing = question
            return
        }
        withAnimation(.easeIn(duration: 0.22)) { dragX = 520 }
        working = question
        Task {
            do {
                let message = try await store.approve(question, text: question.draft ?? "")
                dragX = 0
                successTick += 1
                ToastCenter.shared.show(message)
            } catch {
                withAnimation(.spring(duration: 0.35)) { dragX = 0 }
                failure = APIError.message(error)
            }
            working = nil
        }
    }

    private func decline(_ question: StudioQuestion) {
        guard working == nil else { return }
        withAnimation(.easeIn(duration: 0.22)) { dragX = -520 }
        Task {
            do {
                try await store.decline(question)
                dragX = 0
                ToastCenter.shared.show(question.isStarter ? "Removed." : "Passed — no reply sent.", style: .info)
            } catch {
                withAnimation(.spring(duration: 0.35)) { dragX = 0 }
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
        }
    }
}

struct QuestionCard: View {
    let question: StudioQuestion
    let isTop: Bool
    let dragX: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                if question.isStarter {
                    Kicker("Common fan question", color: Palette.lav)
                } else {
                    InitialAvatar(name: question.fanName ?? "Fan", size: 30, color: Palette.azure)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(question.fanName ?? "A fan")
                            .font(.system(size: 14, weight: .heavy))
                        Text("asked \(Format.relative(question.createdAt))")
                            .font(.system(size: 11))
                            .foregroundStyle(Palette.dim)
                    }
                }
                Spacer()
            }

            Text("“\(question.text)”")
                .font(.system(size: 20, weight: .bold))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("cardQuestion")

            Rectangle().fill(Palette.line2).frame(height: 1)

            Kicker(draftLabel, color: Palette.lav)
            // No inner ScrollView: it would steal the horizontal swipe. Long drafts fade out; Edit shows all of it.
            Text(question.hasDraft ? (question.draft ?? "") : placeholder)
                .font(.system(size: 15))
                .foregroundStyle(question.hasDraft ? Palette.sub2 : Palette.dim2)
                .lineSpacing(3)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.8), .init(color: .clear, location: 1)],
                                     startPoint: .top, endPoint: .bottom))
                .layoutPriority(-1)

            if question.isStarter {
                Text("Approving adds this to your instant answers — fans who ask something like it hear your reply right away.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Palette.dim2)
            }
            if isTop, question.hasDraft {
                VoicePreviewButton(text: question.draft ?? "", id: question.id, title: "Reply preview")
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: 560, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(isTop ? AnyShapeStyle(LinearGradient(colors: [Palette.raised, Palette.card], startPoint: .topLeading, endPoint: .bottomTrailing))
                            : AnyShapeStyle(Palette.card))
        )
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(isTop ? Color(hex: 0x273029) : Palette.line))
        .overlay(alignment: .topLeading) { stamp("SEND IT", Palette.mint, opacity: dragX / 90, angle: -11) }
        .overlay(alignment: .topTrailing) { stamp("PASS", Palette.papaya, opacity: -dragX / 90, angle: 11) }
        .shadow(color: .black.opacity(isTop ? 0.45 : 0.2), radius: 24, y: 14)
    }

    private var draftLabel: String {
        switch question.draftSource {
        case "claude": return "AI draft · from your past answers"
        case "starter": return "Starter draft · make it yours"
        default: return question.hasDraft ? "Draft" : "No draft yet"
        }
    }

    private var placeholder: String {
        question.drafting == true
            ? "Your Coach is drafting a reply…"
            : "Tap Edit to write or dictate your answer — it ships in your voice."
    }

    private func stamp(_ text: String, _ color: Color, opacity: CGFloat, angle: Double) -> some View {
        Text(text)
            .font(.system(size: 22, weight: .black))
            .tracking(2)
            .foregroundStyle(color)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(color, lineWidth: 3))
            .rotationEffect(.degrees(angle))
            .padding(24)
            .opacity(Double(max(0, min(1, opacity))))
            .allowsHitTesting(false)
    }
}

struct VoicingOverlay: View {
    let isStarter: Bool

    var body: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView().controlSize(.large).tint(Palette.mint)
                Text("Voicing your reply…")
                    .font(.system(size: 16, weight: .heavy))
                Text(isStarter ? "Adding it to your instant answers." : "Your fan will hear it in your voice.")
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.sub)
            }
            .padding(28)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Palette.card))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Palette.line2))
        }
        .transition(.opacity)
    }
}

// MARK: - Editor

struct EditReplyView: View {
    @Environment(StudioStore.self) private var store
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let question: StudioQuestion
    @State private var text: String
    @State private var busy = false
    @State private var confirmDelete = false
    @State private var recorder = Recorder()
    @State private var noteState = NoteState.idle
    @State private var previousText: String?
    @State private var pressing = false

    enum NoteState: Equatable {
        case idle, recording, transcribing, revising
    }

    init(question: StudioQuestion) {
        self.question = question
        _text = State(initialValue: question.draft ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Kicker(question.isStarter ? "Common fan question" : "\(question.fanName ?? "A fan") asked", color: Palette.dim2)
                        Text(question.text)
                            .font(.system(size: 17, weight: .bold))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .card(padding: 14, radius: 16, fill: Palette.card2)

                    Kicker("Your reply · type, dictate, or talk it through", color: Palette.lav)
                    TextEditor(text: $text)
                        .font(.system(size: 16))
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 200)
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line2))
                        .accessibilityIdentifier("replyEditor")
                    Text("Tip: tap the mic on your keyboard to dictate. Whatever you approve ships in your voice.")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.dim2)

                    if app.config.drafting {
                        voiceNote
                    }

                    VoicePreviewButton(text: text, id: "edit-\(question.id)", title: "Reply preview")

                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Text("Delete — I won't answer this one")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Palette.papaya)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                }
                .padding(18)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Palette.bg)
            .navigationTitle("Edit reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        recorder.cancel()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        approve()
                    } label: {
                        if busy { ProgressView() } else { Text("Approve").bold() }
                    }
                    .disabled(busy || text.trimmed.isEmpty || noteState != .idle)
                    .accessibilityIdentifier("approveEdited")
                }
            }
            .confirmationDialog("Delete this question?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete — no reply", role: .destructive) { decline() }
                Button("Keep it", role: .cancel) {}
            } message: {
                Text(question.isStarter ? "It won't become an instant answer." : "The fan is told you passed on this one.")
            }
            .interactiveDismissDisabled(busy || noteState != .idle)
            .onDisappear { recorder.cancel() }
        }
    }

    // MARK: Voice-note revise (needs server-side drafting)

    private var voiceNote: some View {
        HStack(spacing: 14) {
            HoldToTalkOrb(isRecording: noteState == .recording, level: recorder.level, size: 46,
                          onPress: startNote, onRelease: finishNote)
                .frame(width: 70, height: 70)
                .disabled(noteState == .transcribing || noteState == .revising)
            VStack(alignment: .leading, spacing: 3) {
                Text(noteTitle)
                    .font(.system(size: 14, weight: .bold))
                Text("Hold and say what to change — \"mention I got cut at sixteen too\" — your Coach rewrites the draft for you to check.")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.dim2)
                    .fixedSize(horizontal: false, vertical: true)
                if let previousText {
                    Button("Undo rewrite") {
                        text = previousText
                        self.previousText = nil
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Palette.lav)
                }
            }
        }
        .card(padding: 12, radius: 16, fill: Palette.card2)
    }

    private var noteTitle: String {
        switch noteState {
        case .idle: return "Talk it through instead"
        case .recording: return "Listening — release when done"
        case .transcribing: return "Transcribing…"
        case .revising: return "Rewriting your draft…"
        }
    }

    private func startNote() {
        pressing = true
        guard noteState == .idle else { return }
        Task {
            guard await Recorder.requestPermission() else {
                ToastCenter.shared.show("Microphone is off for Strive — turn it on in Settings.", style: .error)
                return
            }
            // The finger may already be up by the time permission resolves.
            guard pressing else { return }
            do {
                try recorder.start()
                noteState = .recording
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
        }
    }

    private func finishNote() {
        pressing = false
        guard noteState == .recording else { return }
        guard let take = recorder.stop() else {
            noteState = .idle
            ToastCenter.shared.show("Hold a little longer to record a note.", style: .info)
            return
        }
        noteState = .transcribing
        Task {
            do {
                let note = try await Transcriber.transcribe(take.url)
                noteState = .revising
                let revised = try await store.revise(question, text: text, note: note)
                previousText = text
                text = revised
                ToastCenter.shared.show("Draft rewritten — give it a read.", style: .info)
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            try? FileManager.default.removeItem(at: take.url)
            noteState = .idle
        }
    }

    // MARK: Decisions

    private func approve() {
        busy = true
        recorder.cancel()
        Task {
            do {
                let message = try await store.approve(question, text: text)
                ToastCenter.shared.show(message)
                dismiss()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }

    private func decline() {
        busy = true
        recorder.cancel()
        Task {
            do {
                try await store.decline(question)
                ToastCenter.shared.show("Passed — no reply sent.", style: .info)
                dismiss()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }
}
