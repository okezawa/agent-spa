const express = require("express");
const { listBookings, createBooking, createBulkBookings, updateBooking, cancelBooking } = require("../controllers/booking.controller");

const router = express.Router();

router.get("/bookings", listBookings);
router.post("/bookings", createBooking);
router.post("/bookings/bulk", createBulkBookings);
router.patch("/bookings/:id", updateBooking);
router.patch("/bookings/:id/cancel", cancelBooking);

module.exports = router;
