import SwiftUI
import UserNotifications
#if canImport(BackgroundTasks)
import BackgroundTasks
#endif

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        if ProcessInfo.processInfo.arguments.contains("-uiTesting") {
            // UI tests always start from a clean install state.
            Keychain.token = nil
            SessionCache.clear()
            DiskCache.clear()
            AudioCache.clear()
            UserDefaults.standard.removeObject(forKey: BackgroundRefresh.lastNotifiedKey)
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await PushRegistrar.upload(deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Push is optional: background refresh + in-app notifications still cover the loop.
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let link = response.notification.request.content.userInfo["link"] as? String
        await MainActor.run {
            switch link {
            case "approve": AppState.shared.pendingRoute = .approve
            case "home": AppState.shared.pendingRoute = .home
            default: AppState.shared.pendingRoute = .ask
            }
        }
    }
}

enum PushRegistrar {
    /// Asks for notification permission (once) and registers for remote pushes.
    @MainActor
    @discardableResult
    static func requestAndRegister() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let granted: Bool
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            granted = true
        case .notDetermined:
            granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        default:
            granted = false
        }
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
            BackgroundRefresh.schedule()
        }
        return granted
    }

    static func upload(_ token: Data) async {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        let api = await MainActor.run { AppState.shared.api }
        try? await api.perform("POST", "devices", ["token": hex, "env": env])
    }
}

/// Without push configured on the server, a periodic background refresh still tells fans when Angela answers.
enum BackgroundRefresh {
    static let identifier = "com.minyawns.strive.refresh"
    static let lastNotifiedKey = "strive.bg.lastNotifiedAt"

    static func schedule() {
        #if canImport(BackgroundTasks)
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
        #endif
    }

    static func run() async {
        schedule()
        guard let token = Keychain.token else { return }
        let api = API()
        api.token = token
        guard let response: NotificationsResponse = try? await api.get("notifications") else { return }

        let defaults = UserDefaults.standard
        let lastNotified = Int64(defaults.double(forKey: lastNotifiedKey))
        let fresh = response.notifications.filter { !$0.read && $0.createdAt > lastNotified }
        if let newest = fresh.first {
            let content = UNMutableNotificationContent()
            content.title = newest.text
            if let sub = newest.sub { content.body = sub }
            content.sound = .default
            content.userInfo = ["link": newest.link ?? "ask"]
            let request = UNNotificationRequest(identifier: newest.id, content: content, trigger: nil)
            try? await UNUserNotificationCenter.current().add(request)
            defaults.set(Double(newest.createdAt), forKey: lastNotifiedKey)
        }
        try? await UNUserNotificationCenter.current().setBadgeCount(response.unread)
    }
}
