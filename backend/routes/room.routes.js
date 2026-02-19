const express = require("express");
const {
  listRooms,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
} = require("../controllers/room.controller");

const router = express.Router();

router.get("/rooms", listRooms);
router.post("/rooms", createRoom);
router.patch("/rooms/:id", updateRoom);
router.patch("/rooms/:id/status", updateRoomStatus);
router.delete("/rooms/:id", deleteRoom);

module.exports = router;
