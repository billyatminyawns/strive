import Foundation
import Security

/// The bearer token lives in the Keychain; everything else the app keeps is disposable cache.
enum Keychain {
    private static let service = "com.minyawns.strive"
    private static let account = "session-token"

    static var token: String? {
        get {
            var query = baseQuery
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
                  let data = item as? Data else { return nil }
            return String(data: data, encoding: .utf8)
        }
        set {
            SecItemDelete(baseQuery as CFDictionary)
            guard let newValue, let data = newValue.data(using: .utf8) else { return }
            var add = baseQuery
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}

/// Last-loaded screens as JSON in Caches, so the app still shows something useful offline.
enum DiskCache {
    private static var directory: URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("screens", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func save<T: Encodable>(_ value: T, as name: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        try? data.write(to: directory.appendingPathComponent(name + ".json"), options: .atomic)
    }

    static func load<T: Decodable>(_ type: T.Type, from name: String) -> T? {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(name + ".json")) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    static func clear() {
        try? FileManager.default.removeItem(at: directory)
    }
}

/// Last known identity, so a cold start without network still opens the right app.
enum SessionCache {
    private static let key = "strive.session.v1"

    private struct Snapshot: Codable {
        let user: User
        let athlete: Athlete
    }

    static func save(user: User, athlete: Athlete) {
        guard let data = try? JSONEncoder().encode(Snapshot(user: user, athlete: athlete)) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> (user: User, athlete: Athlete)? {
        guard let data = UserDefaults.standard.data(forKey: key),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return nil }
        return (snap.user, snap.athlete)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
