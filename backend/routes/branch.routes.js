const express = require("express");
const {
  listBranches,
  createBranch,
  updateBranchStatus,
} = require("../controllers/branch.controller");

const router = express.Router();

router.get("/branches", listBranches);
router.post("/branches", createBranch);
router.patch("/branches/:id/status", updateBranchStatus);

module.exports = router;
