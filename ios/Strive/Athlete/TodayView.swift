import SwiftUI

struct TodayView: View {
    @Environment(StudioStore.self) private var store
    @Environment(AppState.self) private var app
    @State private var editingDrop: Drop?
    @State private var editingBio = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                if let today = store.today {
                    queueHero
                    StatsGrid(stats: today.stats)
                    if today.bioStatus != "approved" {
                        BioPromptCard { editingBio = true }
                    }
                    drafted(today.draftDrops)
                    upNext(today.queued, nextPublishAt: today.nextPublishAt)
                } else if let error = store.todayError {
                    ErrorCard(message: error) { Task { await store.refreshToday() } }
                } else {
                    ProgressView().tint(Palette.lav).frame(maxWidth: .infinity).padding(.top, 90)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await store.refreshAll() }
        .sheet(item: $editingDrop) { drop in DropEditorView(drop: drop) }
        .sheet(isPresented: $editingBio) { BioEditorView() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("\(Format.greeting()), \(app.firstName)")
                    .font(.system(size: 26, weight: .heavy))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(Format.today())
                    .font(.system(size: 13))
                    .foregroundStyle(Palette.dim2)
            }
            Spacer()
            AthleteAvatar(athlete: app.athlete, size: 42)
        }
        .padding(.top, 6)
    }

    @ViewBuilder
    private var queueHero: some View {
        let count = store.queueCount
        if count > 0 {
            VStack(alignment: .leading, spacing: 14) {
                Kicker("Your queue", color: Palette.lav)
                HStack(alignment: .lastTextBaseline, spacing: 12) {
                    Text("\(count)")
                        .font(.system(size: 54, weight: .black))
                        .contentTransition(.numericText())
                    Text(count == 1 ? "question waiting\nfor your voice" : "questions waiting\nfor your voice")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.text2)
                }
                Button("Start approving →") { store.tab = .approve }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("startApproving")
            }
            .padding(20)
            .heroCard()
        } else {
            HStack(spacing: 14) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Palette.mint)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Queue clear")
                        .font(.system(size: 18, weight: .heavy))
                    Text("New fan questions land here — nothing reaches a fan until you approve it.")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.dim2)
                }
            }
            .card(padding: 18, radius: 20)
        }
    }

    @ViewBuilder
    private func drafted(_ drafts: [Drop]) -> some View {
        if !drafts.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Drafted for you", trailing: "approve in one sitting")
                Text("Your Coach drafts drops so you don't have to create them. Hear each one, then approve, edit, or send it back.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Palette.dim2)
                ForEach(drafts) { drop in
                    DraftDropCard(drop: drop) { editingDrop = drop }
                }
            }
        }
    }

    @ViewBuilder
    private func upNext(_ queued: [Drop], nextPublishAt: Int64?) -> some View {
        if !queued.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "Up next", trailing: "one ships each morning at 7 AM")
                ForEach(Array(queued.enumerated()), id: \.element.id) { index, drop in
                    HStack(spacing: 12) {
                        Text(shipLabel(index: index, first: nextPublishAt))
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Palette.azure)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Palette.azure.opacity(0.12)))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(drop.title)
                                .font(.system(size: 14, weight: .bold))
                                .lineLimit(1)
                            Text("Approved · \(Format.clock(drop.duration))")
                                .font(.system(size: 12))
                                .foregroundStyle(Palette.dim2)
                        }
                        Spacer(minLength: 0)
                    }
                    .card(padding: 12, radius: 16, fill: Palette.card2)
                }
            }
        }
    }

    private func shipLabel(index: Int, first: Int64?) -> String {
        guard let firstDate = Format.date(first),
              let date = Calendar.current.date(byAdding: .day, value: index, to: firstDate) else {
            return index == 0 ? "NEXT" : "LATER"
        }
        if Calendar.current.isDateInToday(date) { return "TODAY" }
        if Calendar.current.isDateInTomorrow(date) { return "TOMORROW" }
        let f = DateFormatter()
        f.dateFormat = "EEE"
        return f.string(from: date).uppercased()
    }
}

struct StatsGrid: View {
    let stats: StudioStats

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            tile("\(stats.members)", "Members", stats.membersWeek > 0 ? "+\(stats.membersWeek) this week" : "fans in your room")
            tile(stats.answeredPct.map { "\(Int($0.rounded()))%" } ?? "—", "Answered", "of fan questions")
            tile(Format.hours(stats.medianReplyHours), "Median reply", "wait for fans")
            tile("\(stats.listensWeek)", "Listens", "this week")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("statsGrid")
    }

    private func tile(_ value: String, _ label: String, _ note: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(value)
                .font(.system(size: 24, weight: .black))
                .contentTransition(.numericText())
            Kicker(label, color: Palette.sub)
            Text(note)
                .font(.system(size: 11.5))
                .foregroundStyle(Palette.dim2)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.card2))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2).fill(Palette.lav).frame(width: 3).padding(.vertical, 14)
        }
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Palette.line))
    }
}

struct BioPromptCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "person.wave.2.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Palette.lav)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Palette.lav.opacity(0.12)))
                VStack(alignment: .leading, spacing: 3) {
                    Text("Your voice bio needs your OK")
                        .font(.system(size: 15, weight: .heavy))
                    Text("It's the first thing a new fan hears. Nobody hears it until you approve it.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Palette.dim2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Palette.dim)
            }
            .card(padding: 14, radius: 18, stroke: Palette.lav.opacity(0.3))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("bioPrompt")
    }
}

struct DraftDropCard: View {
    @Environment(StudioStore.self) private var store
    let drop: Drop
    let onEdit: () -> Void
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            VStack(alignment: .leading, spacing: 3) {
                Text(drop.title)
                    .font(.system(size: 16, weight: .heavy))
                if let source = drop.source {
                    Text(source)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Palette.dim2)
                }
            }
            Text(drop.script)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.sub2)
                .lineLimit(3)
                .lineSpacing(2)
            VoicePreviewButton(text: drop.script, id: drop.id, title: drop.title)
            HStack(spacing: 8) {
                Button {
                    approve()
                } label: {
                    ZStack {
                        Text("Approve → queue").opacity(busy ? 0 : 1)
                        if busy { ProgressView().tint(Palette.ink) }
                    }
                }
                .buttonStyle(PrimaryButtonStyle(compact: true))
                .disabled(busy)
                Button("Edit", action: onEdit)
                    .buttonStyle(SecondaryButtonStyle(color: Palette.text2))
                    .disabled(busy)
                Button("Redraft") { redraft() }
                    .buttonStyle(SecondaryButtonStyle(color: Palette.papaya))
                    .disabled(busy)
            }
        }
        .card(padding: 14, radius: 18)
    }

    private func approve() {
        busy = true
        Task {
            do {
                _ = try await store.approveDrop(drop)
                ToastCenter.shared.show("Approved — queued in your voice")
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }

    private func redraft() {
        busy = true
        Task {
            do {
                try await store.rejectDrop(drop)
                ToastCenter.shared.show("Sent back — your Coach will take another angle.", style: .info)
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }
}

struct DropEditorView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let drop: Drop
    @State private var title: String
    @State private var script: String
    @State private var busy = false

    init(drop: Drop) {
        self.drop = drop
        _title = State(initialValue: drop.title)
        _script = State(initialValue: drop.script)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Kicker("Title", color: Palette.lav)
                    TextField("Title", text: $title)
                        .font(.system(size: 18, weight: .bold))
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line2))
                    Kicker("What fans will hear", color: Palette.lav)
                    TextEditor(text: $script)
                        .font(.system(size: 16))
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 220)
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line2))
                    Text("Tip: tap the mic on your keyboard to dictate changes.")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.dim2)
                    VoicePreviewButton(text: script, id: "drop-edit-\(drop.id)", title: title)
                    Button {
                        save(publishNow: true)
                    } label: {
                        Text("Publish now instead")
                    }
                    .buttonStyle(SecondaryButtonStyle(fullWidth: true))
                    .disabled(busy || script.trimmed.isEmpty)
                }
                .padding(18)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Palette.bg)
            .navigationTitle("Edit drop")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save(publishNow: false)
                    } label: {
                        if busy { ProgressView() } else { Text("Approve").bold() }
                    }
                    .disabled(busy || script.trimmed.isEmpty || title.trimmed.isEmpty)
                }
            }
        }
    }

    private func save(publishNow: Bool) {
        busy = true
        Task {
            do {
                _ = try await store.approveDrop(drop, title: title, script: script, publishNow: publishNow)
                ToastCenter.shared.show(publishNow ? "Published — fans can hear it now" : "Approved — queued in your voice")
                dismiss()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }
}

struct BioEditorView: View {
    @Environment(StudioStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var loaded = false
    @State private var busy = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("This is the first thing a new fan hears — who you are, in your own words. Keep it short and yours.")
                        .font(.system(size: 14))
                        .foregroundStyle(Palette.sub)
                    TextEditor(text: $text)
                        .font(.system(size: 16))
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 240)
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line2))
                    if store.bio?.isApproved == true {
                        Label("Approved — fans hear this on your profile", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Palette.mint)
                    }
                    VoicePreviewButton(text: text, id: "bio", title: "Your voice bio")
                }
                .padding(18)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Palette.bg)
            .navigationTitle("Voice bio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        approve()
                    } label: {
                        if busy { ProgressView() } else { Text("Approve").bold() }
                    }
                    .disabled(busy || text.trimmed.isEmpty)
                }
            }
            .task {
                guard !loaded else { return }
                await store.loadBio()
                text = store.bio?.text ?? ""
                loaded = true
            }
        }
    }

    private func approve() {
        busy = true
        Task {
            do {
                try await store.approveBio(text: text)
                ToastCenter.shared.show("Bio approved — fans hear it on your profile")
                dismiss()
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            busy = false
        }
    }
}
