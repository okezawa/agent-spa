const express = require("express");
const {
  listBranches,
  createBranch,
  updateBranchStatus,
  updateBranch,
  deleteBranch,
} = require("../controllers/branch.controller");

const router = express.Router();

router.get("/branches", listBranches);
router.post("/branches", createBranch);
router.patch("/branches/:id", updateBranch);
router.patch("/branches/:id/status", updateBranchStatus);
router.delete("/branches/:id", deleteBranch);

module.exports = router;
