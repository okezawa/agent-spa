const express = require("express");
const {
  listServices,
  createService,
  updateService,
  deleteService,
} = require("../controllers/service.controller");

const router = express.Router();

router.get("/services", listServices);
router.post("/services", createService);
router.patch("/services/:id", updateService);
router.delete("/services/:id", deleteService);

module.exports = router;
