const express = require("express");
const { listGuests, searchGuests, createGuest } = require("../controllers/guest.controller");

const router = express.Router();

router.get("/guests", listGuests);
router.get("/guests/search", searchGuests);
router.post("/guests", createGuest);

module.exports = router;
