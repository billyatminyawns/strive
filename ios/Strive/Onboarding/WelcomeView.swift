import SwiftUI

struct WelcomeView: View {
    @Environment(AppState.self) private var app
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?
    @State private var showAthleteSignIn = false
    @FocusState private var codeFocused: Bool

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                form
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(edges: .top)
        .background(Palette.bg)
        .sheet(isPresented: $showAthleteSignIn) {
            AthleteSignInView()
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottom) {
            AthleteImage(athlete: nil, kind: .action)
                .frame(height: 380)
                .frame(maxWidth: .infinity)
                .clipped()
            LinearGradient(colors: [Palette.bg.opacity(0.1), Palette.bg.opacity(0.55), Palette.bg],
                           startPoint: .top, endPoint: .bottom)
            Wordmark(size: 32)
                .padding(.bottom, 6)
        }
        .frame(height: 380)
    }

    private var form: some View {
        VStack(spacing: 16) {
            Kicker("VIP access · founding fan")
                .padding(.top, 6)
            Text("Angela saved you a seat")
                .font(.system(size: 29, weight: .heavy))
                .multilineTextAlignment(.center)
            Text("Train with Olympic champion Angela Ruggiero — voice drops, and your questions answered back in her voice. Invite-only while the first athletes build their rooms.")
                .font(.system(size: 15))
                .foregroundStyle(Palette.sub)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 8) {
                TextField("", text: $code, prompt: Text("INVITE CODE").foregroundStyle(Palette.dim))
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .tracking(5)
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .focused($codeFocused)
                    .onSubmit(unlock)
                    .padding(.vertical, 16)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(error == nil ? Palette.line2 : Palette.papaya, lineWidth: 1))
                    .onChange(of: code) { _, value in
                        let cleaned = String(value.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(12))
                        if cleaned != value { code = cleaned }
                        error = nil
                    }
                    .accessibilityLabel("Invite code")
                    .accessibilityIdentifier("inviteCode")

                if let error {
                    Text(error)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Palette.papaya)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("inviteError")
                }
            }
            .padding(.top, 6)

            Button(action: unlock) {
                ZStack {
                    Text("Unlock").opacity(busy ? 0 : 1)
                    if busy { ProgressView().tint(Palette.ink) }
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(code.count < 3 || busy)
            .accessibilityIdentifier("unlock")

            Text("Every reply is written or approved by Angela, then spoken in her AI voice.")
                .font(.system(size: 12))
                .foregroundStyle(Palette.dim2)
                .multilineTextAlignment(.center)

            Button("I'm an athlete — sign in to my studio") { showAthleteSignIn = true }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Palette.lav)
                .padding(.top, 8)
                .accessibilityIdentifier("athleteSignIn")

            LegalLinks()
                .padding(.top, 6)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 36)
    }

    private func unlock() {
        guard !busy, code.count >= 3 else { return }
        busy = true
        codeFocused = false
        Task {
            do {
                try await app.signInFan(code: code)
            } catch {
                self.error = APIError.message(error)
            }
            busy = false
        }
    }
}

struct InterestsView: View {
    static let pool = ["Mindset", "Nutrition", "Recovery", "Training", "Stories", "Leadership", "Culture", "Hockey IQ"]

    @Environment(AppState.self) private var app
    @State private var name = ""
    @State private var picked: [String] = ["Mindset", "Stories"]
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                AthleteAvatar(athlete: app.athlete, size: 86)
                    .padding(.top, 56)
                Text("You're in.")
                    .font(.system(size: 32, weight: .heavy))
                    .accessibilityIdentifier("interestsTitle")
                Text("\(app.firstName) personally invited her first fans. Tell her a little about you.")
                    .font(.system(size: 15))
                    .foregroundStyle(Palette.sub)
                    .multilineTextAlignment(.center)

                VStack(alignment: .leading, spacing: 8) {
                    Kicker("What should \(app.firstName) call you?", color: Palette.dim2)
                    TextField("Your first name", text: $name)
                        .font(.system(size: 17, weight: .semibold))
                        .textContentType(.givenName)
                        .submitLabel(.done)
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.line2))
                        .accessibilityIdentifier("nameField")
                }
                .padding(.top, 8)

                VStack(alignment: .leading, spacing: 10) {
                    Kicker("What do you want from her?", color: Palette.dim2)
                    FlowLayout(spacing: 9, lineSpacing: 9) {
                        ForEach(Self.pool, id: \.self) { tag in
                            Chip(text: tag, selected: picked.contains(tag)) {
                                if let i = picked.firstIndex(of: tag) { picked.remove(at: i) } else { picked.append(tag) }
                            }
                            .accessibilityIdentifier("chip-\(tag)")
                        }
                    }
                    Text("General first, sport-deep when you want it — you don't need to know what gap control is to belong here.")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.dim2)
                }
                .padding(.top, 6)

                Button {
                    finish(name: name, interests: picked)
                } label: {
                    ZStack {
                        Text(picked.isEmpty ? "Enter Strive" : "Enter Strive · \(picked.count) picked").opacity(busy ? 0 : 1)
                        if busy { ProgressView().tint(Palette.ink) }
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy)
                .padding(.top, 10)
                .accessibilityIdentifier("enterApp")

                Button("Skip for now") { finish(name: nil, interests: []) }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Palette.dim2)
                    .disabled(busy)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 36)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.bg)
    }

    private func finish(name: String?, interests: [String]) {
        busy = true
        Task { await app.completeOnboarding(name: name, interests: interests) }
    }
}

struct AthleteSignInView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var key = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Kicker("Athlete studio", color: Palette.lav)
                Text("Sign in to your studio")
                    .font(.system(size: 28, weight: .heavy))
                Text("Use the studio key from your Strive team. You approve everything before a single fan hears it.")
                    .font(.system(size: 15))
                    .foregroundStyle(Palette.sub)
                SecureField("Studio key", text: $key)
                    .font(.system(size: 17, weight: .semibold))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.password)
                    .submitLabel(.go)
                    .onSubmit(signIn)
                    .padding(14)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(error == nil ? Palette.line2 : Palette.papaya))
                    .accessibilityIdentifier("studioKey")
                if let error {
                    Text(error)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Palette.papaya)
                }
                Button(action: signIn) {
                    ZStack {
                        Text("Sign in").opacity(busy ? 0 : 1)
                        if busy { ProgressView().tint(Palette.ink) }
                    }
                }
                .buttonStyle(PrimaryButtonStyle(color: Palette.lav))
                .disabled(key.trimmed.isEmpty || busy)
                .accessibilityIdentifier("studioSignIn")
                Spacer()
            }
            .padding(24)
            .background(Palette.bg)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func signIn() {
        guard !busy, !key.trimmed.isEmpty else { return }
        busy = true
        error = nil
        Task {
            do {
                try await app.signInAthlete(key: key)
                dismiss()
            } catch {
                self.error = (error as? APIError)?.status == 401 ? "That studio key didn't work." : APIError.message(error)
            }
            busy = false
        }
    }
}
