const express = require("express");
const {
  listEmployees,
  createEmployee,
  listPendingEmployees,
  loginEmployee,
  getCurrentEmployee,
  logoutEmployee,
  approveEmployee,
} = require("../controllers/employee.controller");

const router = express.Router();

router.get("/employees", listEmployees);
router.get("/employees/pending", listPendingEmployees);
router.get("/employees/me", getCurrentEmployee);
router.post("/employees", createEmployee);
router.post("/employees/login", loginEmployee);
router.post("/employees/logout", logoutEmployee);
router.patch("/employees/:id/approve", approveEmployee);

module.exports = router;
