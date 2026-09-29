import SwiftUI
import Observation

/// Session + identity for the whole app. Decides whether you see onboarding, the fan app, or the athlete studio.
@MainActor
@Observable
final class AppState {
    static let shared = AppState()

    enum Phase: Equatable {
        case launching, signedOut, interests, fan, athlete
    }

    /// Where a tapped notification wants to take the user.
    enum Route: Equatable {
        case ask, home, approve
    }

    private(set) var phase: Phase = .launching
    private(set) var user: User?
    private(set) var athlete: Athlete?
    private(set) var config = AppConfig.fallback
    var pendingRoute: Route?

    @ObservationIgnored let api = API()

    private init() {
        api.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.endSession() }
        }
    }

    var firstName: String { athlete?.firstName ?? "Angela" }

    // MARK: Launch

    func bootstrap() async {
        guard phase == .launching else { return }
        Task { await loadConfig() }

        guard let token = Keychain.token else {
            phase = .signedOut
            return
        }
        api.token = token
        do {
            let me: MeResponse = try await api.get("me")
            adopt(user: me.user, athlete: me.athlete)
        } catch let error as APIError where error.status == 401 {
            endSession()
        } catch {
            // Offline cold start: open the right experience from the cached identity; screens retry on their own.
            if let cached = SessionCache.load() {
                adopt(user: cached.user, athlete: cached.athlete)
            } else {
                phase = .signedOut
            }
        }
    }

    func loadConfig() async {
        if let config: AppConfig = try? await api.get("config") {
            self.config = config
        }
    }

    // MARK: Sign-in

    func signInFan(code: String) async throws {
        let response: AuthResponse = try await api.post("auth/fan", ["code": code.trimmed.uppercased()])
        start(response)
        phase = .interests
    }

    func completeOnboarding(name: String?, interests: [String]) async {
        var body: [String: Any] = [:]
        if let name = name?.trimmed, !name.isEmpty { body["name"] = String(name.prefix(40)) }
        if !interests.isEmpty { body["interests"] = interests }
        if !body.isEmpty {
            try? await updateProfile(body)
        }
        phase = .fan
    }

    func signInAthlete(key: String) async throws {
        let response: AuthResponse = try await api.post("auth/athlete", ["key": key.trimmed])
        start(response)
        phase = .athlete
    }

    private func start(_ response: AuthResponse) {
        Keychain.token = response.token
        api.token = response.token
        user = response.user
        athlete = response.athlete
        SessionCache.save(user: response.user, athlete: response.athlete)
    }

    private func adopt(user: User, athlete: Athlete) {
        self.user = user
        self.athlete = athlete
        SessionCache.save(user: user, athlete: athlete)
        phase = user.role == .athlete ? .athlete : .fan
    }

    // MARK: Profile

    func updateProfile(_ changes: [String: Any]) async throws {
        let response: UserEnvelope = try await api.patch("me", changes)
        user = response.user
        if let athlete { SessionCache.save(user: response.user, athlete: athlete) }
    }

    func updateAthlete(_ athlete: Athlete) {
        guard athlete != self.athlete else { return }
        self.athlete = athlete
        if let user { SessionCache.save(user: user, athlete: athlete) }
    }

    // MARK: Leaving

    func signOut() async {
        try? await api.perform("POST", "auth/signout")
        endSession()
    }

    func deleteAccount() async throws {
        try await api.perform("DELETE", "me")
        endSession()
    }

    func endSession() {
        guard phase != .signedOut || user != nil else { return }
        Keychain.token = nil
        api.token = nil
        user = nil
        athlete = nil
        pendingRoute = nil
        SessionCache.clear()
        DiskCache.clear()
        AudioEngine.shared.stop()
        AudioCache.clear()
        phase = .signedOut
    }
}
