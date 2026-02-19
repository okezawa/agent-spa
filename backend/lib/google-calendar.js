const fs = require("node:fs/promises");
const path = require("node:path");

const tokenFilePath = path.join(__dirname, "..", ".google-calendar-token.json");
const syncFilePath = path.join(__dirname, "..", ".google-calendar-sync.json");

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const defaultScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
];

function getEnvConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:4200",
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || "Asia/Bangkok",
  };
}

function isConfigured() {
  const { clientId, clientSecret, redirectUri } = getEnvConfig();
  return Boolean(clientId && clientSecret && redirectUri);
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function getToken() {
  return readJson(tokenFilePath, null);
}

async function saveToken(tokenPayload) {
  await writeJson(tokenFilePath, tokenPayload);
}

async function clearToken() {
  try {
    await fs.unlink(tokenFilePath);
  } catch {
    // ignore missing file
  }
}

async function getSyncMap() {
  return readJson(syncFilePath, {});
}

async function saveSyncMap(map) {
  await writeJson(syncFilePath, map);
}

async function removeSyncedBooking(bookingId) {
  const map = await getSyncMap();
  delete map[String(bookingId)];
  await saveSyncMap(map);
}

async function setSyncedBooking(bookingId, eventId) {
  const map = await getSyncMap();
  map[String(bookingId)] = eventId;
  await saveSyncMap(map);
}

async function getSyncedEventId(bookingId) {
  const map = await getSyncMap();
  return map[String(bookingId)] || null;
}

function buildAuthUrl() {
  if (!isConfigured()) {
    return null;
  }

  const { clientId, redirectUri } = getEnvConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: defaultScopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
  });

  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { clientId, clientSecret, redirectUri } = getEnvConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "token exchange failed");
  }

  const now = Date.now();
  const expiresAt = now + Number(payload.expires_in || 0) * 1000;

  const existing = await getToken();

  const tokenData = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || existing?.refreshToken || null,
    expiryDate: expiresAt,
    idToken: payload.id_token || null,
    scope: payload.scope || null,
    tokenType: payload.token_type || "Bearer",
  };

  await saveToken(tokenData);
  return tokenData;
}

async function refreshTokenIfNeeded(tokenData) {
  if (!tokenData?.refreshToken) {
    return tokenData;
  }

  const expiresSoon = !tokenData.expiryDate || tokenData.expiryDate - Date.now() < 60_000;
  if (!expiresSoon) {
    return tokenData;
  }

  const { clientId, clientSecret } = getEnvConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokenData.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || "token refresh failed");
  }

  const updated = {
    ...tokenData,
    accessToken: payload.access_token,
    expiryDate: Date.now() + Number(payload.expires_in || 0) * 1000,
    scope: payload.scope || tokenData.scope || null,
    tokenType: payload.token_type || tokenData.tokenType || "Bearer",
  };

  await saveToken(updated);
  return updated;
}

async function getValidAccessToken() {
  if (!isConfigured()) {
    return null;
  }

  const tokenData = await getToken();
  if (!tokenData?.accessToken) {
    return null;
  }

  const refreshed = await refreshTokenIfNeeded(tokenData);
  return refreshed.accessToken;
}

async function calendarRequest(method, endpoint, body) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { ok: false, payload: { message: "not connected" }, status: 401 };
  }

  const { calendarId } = getEnvConfig();
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload, status: response.status };
}

function eventPayloadFromBooking(booking) {
  const { timeZone } = getEnvConfig();
  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;
  const employeeName = `${booking.employee.firstName} ${booking.employee.lastName}`;

  return {
    summary: `${booking.service.name} - ${guestName}`,
    description: [
      `Booking ID: ${booking.id}`,
      `Guest: ${booking.guest.memberCode} ${guestName}`,
      `Phone: ${booking.guest.phone || "-"}`,
      `Room: ${booking.room.name}`,
      `Branch: ${booking.room.branch.code} ${booking.room.branch.name}`,
      `Employee: ${employeeName}`,
      `Service: ${booking.service.name}`,
      `Status: ${booking.status}`,
      booking.notes ? `Notes: ${booking.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: {
      dateTime: new Date(booking.startAt).toISOString(),
      timeZone,
    },
    end: {
      dateTime: new Date(booking.endAt).toISOString(),
      timeZone,
    },
    status: booking.status === "CANCELLED" ? "cancelled" : "confirmed",
    extendedProperties: {
      private: {
        bookingId: String(booking.id),
      },
    },
  };
}

async function syncBookingToGoogleCalendar(booking) {
  if (!isConfigured()) {
    return { synced: false, reason: "not_configured" };
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { synced: false, reason: "not_connected" };
  }

  const eventBody = eventPayloadFromBooking(booking);
  const existingEventId = await getSyncedEventId(booking.id);

  if (existingEventId) {
    const update = await calendarRequest("PATCH", `/events/${encodeURIComponent(existingEventId)}`, eventBody);
    if (update.ok) {
      return { synced: true, eventId: existingEventId, action: "updated" };
    }

    if (update.status === 404) {
      await removeSyncedBooking(booking.id);
    } else {
      throw new Error(update.payload?.error?.message || "google event update failed");
    }
  }

  const create = await calendarRequest("POST", "/events", eventBody);
  if (!create.ok) {
    throw new Error(create.payload?.error?.message || "google event create failed");
  }

  const eventId = create.payload?.id;
  if (eventId) {
    await setSyncedBooking(booking.id, eventId);
  }

  return { synced: true, eventId, action: "created" };
}

async function getConnectionStatus() {
  const token = await getToken();
  return {
    configured: isConfigured(),
    connected: Boolean(token?.accessToken),
    expiryDate: token?.expiryDate || null,
  };
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  getConnectionStatus,
  clearToken,
  syncBookingToGoogleCalendar,
};
