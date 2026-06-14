import express from "express";
import Asset from "../models/Asset.js";
import Employee from "../models/Employee.js";
import Expense from "../models/Expense.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Payroll from "../models/Payroll.js";
import Project from "../models/Project.js";
import Timesheet from "../models/Timesheet.js";
import { requireAuth } from "../middleware/auth.js";
import { crudRouter } from "./crudFactory.js";

const router = express.Router();
router.use(requireAuth);

const roles = {
  employee: ["SUPER_ADMIN", "HR_MANAGER", "DATA_CLERK"],
  project: ["SUPER_ADMIN", "PROJECT_MANAGER", "DATA_CLERK"],
  accounts: ["SUPER_ADMIN", "ACCOUNTS_OFFICER", "DATA_CLERK"],
  supervisor: ["SUPER_ADMIN", "PROJECT_MANAGER", "SITE_SUPERVISOR", "DATA_CLERK"]
};

function mount(path, model, roleSet) {
  const crud = crudRouter(model, { createRoles: roleSet, updateRoles: roleSet, deleteRoles: ["SUPER_ADMIN"] });
  router.get(path, crud.list);
  router.post(path, crud.create);
  router.patch(`${path}/:id`, crud.update);
  router.delete(`${path}/:id`, crud.remove);
}

mount("/employees", Employee, roles.employee);
mount("/projects", Project, roles.project);
mount("/expenses", Expense, roles.accounts);
mount("/leave-requests", LeaveRequest, ["SUPER_ADMIN", "HR_MANAGER", "EMPLOYEE", "DATA_CLERK"]);
mount("/payroll", Payroll, ["SUPER_ADMIN", "HR_MANAGER", "ACCOUNTS_OFFICER"]);
mount("/timesheets", Timesheet, roles.supervisor);
mount("/assets", Asset, ["SUPER_ADMIN", "PROJECT_MANAGER", "ACCOUNTS_OFFICER", "DATA_CLERK"]);

router.post("/assets/:id/assignments", async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
  if (!asset) return res.status(404).json({ message: "Asset not found" });
  asset.assignments.push({ ...req.body, assignedBy: req.user._id });
  asset.status = "Assigned";
  await asset.save();
  res.status(201).json(asset);
});

router.post("/assets/:id/maintenance", async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
  if (!asset) return res.status(404).json({ message: "Asset not found" });
  asset.maintenance.push({ ...req.body, recordedBy: req.user._id });
  asset.status = req.body.maintenanceType === "Repair" ? "Under Maintenance" : asset.status;
  await asset.save();
  res.status(201).json(asset);
});

router.post("/assets/:id/fuel-logs", async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
  if (!asset) return res.status(404).json({ message: "Asset not found" });
  asset.fuelLogs.push({ ...req.body, recordedBy: req.user._id });
  await asset.save();
  res.status(201).json(asset);
});

export default router;
