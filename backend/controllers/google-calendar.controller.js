const {
  isConfigured,
  buildAuthUrl,
  exchangeCodeForToken,
  getConnectionStatus,
  clearToken,
} = require("../lib/google-calendar");

async function getGoogleCalendarStatus(_req, res, next) {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
}

function getGoogleCalendarAuthUrl(_req, res) {
  if (!isConfigured()) {
    return res.status(400).json({
      message: "Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI",
    });
  }

  const authUrl = buildAuthUrl();
  return res.json({ authUrl });
}

async function googleCalendarCallback(req, res, next) {
  try {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";

    if (error) {
      return res.status(400).send(`Google authorization failed: ${String(error)}`);
    }

    if (!code || typeof code !== "string") {
      return res.status(400).send("Missing authorization code");
    }

    await exchangeCodeForToken(code);

    return res.send(`
      <html>
        <body style="font-family:sans-serif;padding:24px;">
          <h2>Google Calendar connected</h2>
          <p>You can close this window.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'google-calendar-connected' }, '${frontendUrl}');
              window.close();
            } else {
              window.location.href = '${frontendUrl}/bookings?googleCalendar=connected';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
}

async function disconnectGoogleCalendar(_req, res, next) {
  try {
    await clearToken();
    res.json({ message: "Google Calendar disconnected" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGoogleCalendarStatus,
  getGoogleCalendarAuthUrl,
  googleCalendarCallback,
  disconnectGoogleCalendar,
};
