import Foundation

struct APIError: LocalizedError, Equatable {
    let status: Int
    let message: String

    var errorDescription: String? { message }

    static let offline = APIError(status: -1, message: "You're offline — check your connection and try again.")
    static let badResponse = APIError(status: -2, message: "Something went wrong on our side. Please try again.")

    static func message(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Please try again."
    }
}

/// Thin async client for Strive API v1. Stateless apart from the bearer token.
final class API: @unchecked Sendable {
    static let defaultBase = URL(string: "https://strive-api.billyatminyawns.workers.dev/v1/")!

    /// UI tests can point the app at a local server with `STRIVE_API_BASE`.
    let baseURL: URL
    var token: String?
    var onUnauthorized: (() -> Void)?

    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL = API.configuredBase) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config)
    }

    static var configuredBase: URL {
        if let override = ProcessInfo.processInfo.environment["STRIVE_API_BASE"],
           let url = URL(string: override.hasSuffix("/") ? override : override + "/") {
            return url
        }
        return defaultBase
    }

    // MARK: Verbs

    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try decode(try await raw("GET", path))
    }

    func post<T: Decodable>(_ path: String, _ body: [String: Any]? = nil, as type: T.Type = T.self) async throws -> T {
        try decode(try await raw("POST", path, body: body ?? [:]))
    }

    func patch<T: Decodable>(_ path: String, _ body: [String: Any], as type: T.Type = T.self) async throws -> T {
        try decode(try await raw("PATCH", path, body: body))
    }

    func delete<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try decode(try await raw("DELETE", path))
    }

    /// Fire a request when only success matters.
    func perform(_ method: String, _ path: String, _ body: [String: Any]? = nil) async throws {
        _ = try await raw(method, path, body: body ?? (method == "GET" || method == "DELETE" ? nil : [:]))
    }

    func audio(_ key: String) async throws -> Data {
        try await raw("GET", "audio/" + key, accept: "audio/mpeg")
    }

    // MARK: Transport

    func raw(_ method: String, _ path: String, body: [String: Any]? = nil, accept: String = "application/json") async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.badResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(accept, forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ServerError.self, from: data))?.error
            if status == 401, token != nil { onUnauthorized?() }
            throw APIError(status: status, message: message ?? Self.fallbackMessage(status))
        }
        return data
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            #if DEBUG
            print("Strive decode failure for \(T.self): \(error)")
            #endif
            throw APIError.badResponse
        }
    }

    private static func fallbackMessage(_ status: Int) -> String {
        switch status {
        case 401: return "Your session ended. Please sign in again."
        case 403: return "That isn't available on this account."
        case 404: return "We couldn't find that."
        case 429: return "Slow down a little — try again soon."
        case 500...: return "Strive is having a moment. Please try again."
        default: return "Something went wrong. Please try again."
        }
    }

    private struct ServerError: Decodable { let error: String }
}
