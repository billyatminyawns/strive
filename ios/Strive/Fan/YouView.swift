import SwiftUI
import UserNotifications

struct YouView: View {
    @Environment(AppState.self) private var app
    @Environment(FanStore.self) private var store
    @Environment(\.openURL) private var openURL
    @State private var name = ""
    @State private var interests: [String] = []
    @State private var savingName = false
    @State private var notificationStatus: UNAuthorizationStatus = .notDetermined
    @State private var confirmDelete = false
    @State private var deleting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                profileHeader
                nameCard
                interestsCard
                notificationsCard
                howItWorksCard
                linksCard
                deleteButton
                Text("Strive \(Bundle.main.appVersion)")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.dim)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 30)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.bg)
        .toolbar(.hidden, for: .navigationBar)
        .task {
            name = app.user?.name ?? ""
            interests = app.user?.interests ?? []
            await refreshNotificationStatus()
        }
        .confirmationDialog("Delete your Strive account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account", role: .destructive) { deleteAccount() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your profile, your questions and saved replies. It can't be undone.")
        }
    }

    private var profileHeader: some View {
        HStack(spacing: 14) {
            InitialAvatar(name: app.user?.name ?? "Fan", size: 58)
            VStack(alignment: .leading, spacing: 3) {
                Text(app.user?.name?.isEmpty == false ? app.user!.name! : "Founding fan")
                    .font(.system(size: 22, weight: .heavy))
                Text("Founding fan of \(app.athlete?.name ?? "Angela Ruggiero")\(memberSince)")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Palette.dim2)
            }
        }
        .padding(.top, 10)
    }

    private var memberSince: String {
        guard let date = Format.date(app.user?.createdAt) else { return "" }
        let f = DateFormatter()
        f.dateFormat = "MMM yyyy"
        return " · since \(f.string(from: date))"
    }

    private var nameCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("What \(app.firstName) calls you", color: Palette.dim2)
            HStack(spacing: 10) {
                TextField("Your first name", text: $name)
                    .font(.system(size: 16, weight: .semibold))
                    .textContentType(.givenName)
                    .submitLabel(.done)
                    .onSubmit(saveName)
                if name.trimmed != (app.user?.name ?? "") {
                    Button(action: saveName) {
                        if savingName { ProgressView().tint(Palette.ink) } else { Text("Save") }
                    }
                    .buttonStyle(PrimaryButtonStyle(fullWidth: false, compact: true))
                    .disabled(savingName)
                }
            }
        }
        .card(padding: 16, radius: 18)
    }

    private var interestsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Kicker("Your interests", color: Palette.dim2)
            FlowLayout(spacing: 8, lineSpacing: 8) {
                ForEach(InterestsView.pool, id: \.self) { tag in
                    Chip(text: tag, selected: interests.contains(tag)) { toggleInterest(tag) }
                }
            }
            Text("Suggestions and drops tune to these.")
                .font(.system(size: 12))
                .foregroundStyle(Palette.dim2)
        }
        .card(padding: 16, radius: 18)
    }

    private var notificationsCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 18))
                .foregroundStyle(Palette.mint)
            VStack(alignment: .leading, spacing: 2) {
                Text("Replies & new drops")
                    .font(.system(size: 15, weight: .bold))
                Text(notificationSubtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.dim2)
            }
            Spacer(minLength: 0)
            switch notificationStatus {
            case .notDetermined:
                Button("Turn on") {
                    Task {
                        await PushRegistrar.requestAndRegister()
                        await refreshNotificationStatus()
                    }
                }
                .buttonStyle(PrimaryButtonStyle(fullWidth: false, compact: true))
            case .denied:
                Button("Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .buttonStyle(SecondaryButtonStyle())
            default:
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.mint)
            }
        }
        .card(padding: 16, radius: 18)
    }

    private var notificationSubtitle: String {
        switch notificationStatus {
        case .denied: return "Off — turn on in Settings to hear when \(app.firstName) answers."
        case .notDetermined: return "Get a ping when \(app.firstName) answers you."
        default: return "On"
        }
    }

    private var howItWorksCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("How Strive works", color: Palette.dim2)
            howRow("checkmark.seal.fill", "Every reply and drop is written or approved by \(app.firstName) before anyone hears it.")
            howRow("waveform", "You hear it in her voice — an AI voice model made with her permission, labelled wherever it plays.")
            howRow("hand.raised.fill", "Medical, betting and legal questions get a polite pass. Your questions are only seen by \(app.firstName) and the Strive team.")
        }
        .card(padding: 16, radius: 18)
    }

    private func howRow(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Palette.mint)
                .frame(width: 18)
                .padding(.top, 2)
            Text(text)
                .font(.system(size: 13.5))
                .foregroundStyle(Palette.sub2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var linksCard: some View {
        VStack(spacing: 0) {
            linkRow("Privacy Policy", Links.privacy)
            Divider().overlay(Palette.line)
            linkRow("Terms of Use", Links.terms)
            Divider().overlay(Palette.line)
            linkRow("Help & support", Links.support)
        }
        .card(padding: 4, radius: 18)
    }

    private func linkRow(_ title: String, _ url: URL) -> some View {
        Button {
            openURL(url)
        } label: {
            HStack {
                Text(title).font(.system(size: 15, weight: .semibold))
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Palette.dim)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            confirmDelete = true
        } label: {
            HStack {
                if deleting { ProgressView().tint(Palette.red) }
                Text("Delete account")
            }
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Palette.red)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Palette.red.opacity(0.35)))
        }
        .buttonStyle(.plain)
        .disabled(deleting)
        .accessibilityIdentifier("deleteAccount")
    }

    // MARK: Actions

    private func saveName() {
        let trimmed = name.trimmed
        guard trimmed != (app.user?.name ?? ""), !savingName else { return }
        savingName = true
        Task {
            do {
                try await app.updateProfile(["name": String(trimmed.prefix(40))])
                ToastCenter.shared.show("Saved — \(app.firstName) will call you \(trimmed.isEmpty ? "friend" : trimmed)")
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
            savingName = false
        }
    }

    private func toggleInterest(_ tag: String) {
        if let i = interests.firstIndex(of: tag) { interests.remove(at: i) } else { interests.append(tag) }
        let snapshot = interests
        Task {
            do {
                try await app.updateProfile(["interests": snapshot])
            } catch {
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
        }
    }

    private func refreshNotificationStatus() async {
        notificationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    private func deleteAccount() {
        deleting = true
        Task {
            do {
                try await app.deleteAccount()
            } catch {
                deleting = false
                ToastCenter.shared.show(APIError.message(error), style: .error)
            }
        }
    }
}

extension Bundle {
    var appVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
