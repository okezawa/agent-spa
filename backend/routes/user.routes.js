const express = require("express");
const { listUsers, createUser } = require("../controllers/user.controller");

const router = express.Router();

router.get("/users", listUsers);
router.post("/users", createUser);

module.exports = router;
