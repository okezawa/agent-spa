const express = require("express");
const {
  getGoogleCalendarStatus,
  getGoogleCalendarAuthUrl,
  googleCalendarCallback,
  disconnectGoogleCalendar,
} = require("../controllers/google-calendar.controller");

const router = express.Router();

router.get("/google-calendar/status", getGoogleCalendarStatus);
router.get("/google-calendar/auth-url", getGoogleCalendarAuthUrl);
router.get("/google-calendar/callback", googleCalendarCallback);
router.post("/google-calendar/disconnect", disconnectGoogleCalendar);

module.exports = router;
