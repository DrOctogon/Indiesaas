/**
 * Minimal HomeCare Web Push service worker. Handles incoming `push` messages by
 * showing a notification, and `notificationclick` by focusing/opening the app.
 * The payload is the JSON produced by `buildPushPayload` ({ title, body, url? }).
 */

self.addEventListener("push", (event) => {
    let payload = { title: "HomeCare", body: "" }
    try {
        if (event.data) {
            payload = event.data.json()
        }
    } catch {
        payload = {
            title: "HomeCare",
            body: event.data ? event.data.text() : ""
        }
    }

    const title = payload.title || "HomeCare"
    const options = {
        body: payload.body || "",
        icon: "/logo.png",
        badge: "/logo.png",
        data: { url: payload.url || "/" }
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const url = event.notification.data?.url || "/"

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ("focus" in client) {
                        client.navigate(url)
                        return client.focus()
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url)
                }
                return undefined
            })
    )
})
