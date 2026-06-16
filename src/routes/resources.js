import express from "express";
import Asset from "../models/Asset.js";
import Employee from "../models/Employee.js";
import Expense from "../models/Expense.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Payroll from "../models/Payroll.js";
import Project from "../models/Project.js";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { crudRouter } from "./crudFactory.js";

const router = express.Router();
router.use(requireAuth);

const roles = {
  employee:   ["SUPER_ADMIN", "HR_MANAGER", "DATA_CLERK"],
  project:    ["SUPER_ADMIN", "PROJECT_MANAGER", "DATA_CLERK"],
  accounts:   ["SUPER_ADMIN", "ACCOUNTS_OFFICER", "DATA_CLERK"],
  supervisor: ["SUPER_ADMIN", "PROJECT_MANAGER", "SITE_SUPERVISOR", "DATA_CLERK"]
};

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/users", allowRoles("SUPER_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const users = await User.find({ company: req.companyId })
      .populate("employee", "firstName lastName employeeCode position")
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users", detail: err.message });
  }
});

router.post("/users", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const { name, email, password, role, employeeId, active } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ message: "Name, email, password and role are required" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "A user with this email already exists" });

    const user = await User.create({
      company: req.companyId,
      name,
      email,
      password,
      role,
      employee: employeeId || undefined,
      active: active !== false
    });

    const populated = await User.findById(user._id)
      .populate("employee", "firstName lastName employeeCode position")
      .select("-password");

    res.status(201).json(populated);
  } catch (err) {
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors).map(e => e.message).join(", ");
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: "Failed to create user", detail: err.message });
  }
});

router.patch("/users/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const { name, role, employeeId, active } = req.body;
    const update = {};
    if (name      !== undefined) update.name     = name;
    if (role      !== undefined) update.role     = role;
    if (active    !== undefined) update.active   = active;
    if (employeeId !== undefined) update.employee = employeeId || null;

    // If password is being changed, fetch and save via model so hook fires
    if (req.body.password) {
      const user = await User.findOne({ _id: req.params.id, company: req.companyId });
      if (!user) return res.status(404).json({ message: "User not found" });
      Object.assign(user, update);
      user.password = req.body.password;
      await user.save();
      const populated = await User.findById(user._id)
        .populate("employee", "firstName lastName employeeCode position")
        .select("-password");
      return res.json(populated);
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      update,
      { new: true, runValidators: true }
    ).populate("employee", "firstName lastName employeeCode position").select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user", detail: err.message });
  }
});

router.delete("/users/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: "You cannot delete your own account" });

    const user = await User.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user", detail: err.message });
  }
});

// ── Employees (with populated relations) ──────────────────────────────────────

router.get("/employees", async (req, res) => {
  try {
    const docs = await Employee.find({ company: req.companyId }).sort({ createdAt: -1 }).limit(250);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees" });
  }
});

router.post("/employees", allowRoles(...roles.employee), async (req, res) => {
  try {
    const employee = await Employee.create({ ...req.body, company: req.companyId });

    // ERP link: auto-create payroll stub for the current month
    const now = new Date();
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    await Payroll.create({
      company: req.companyId,
      employee: employee._id,
      month: months[now.getMonth()],
      year: now.getFullYear(),
      basicSalary: employee.salary || 0,
      allowances: 0,
      deductions: 0,
      paymentStatus: "Unpaid"
    });

    res.status(201).json(employee);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "An employee with this code already exists" });
    if (err.name === "ValidationError") {
      const msg = Object.values(err.errors).map(e => e.message).join(", ");
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: "Failed to create employee", detail: err.message });
  }
});

router.patch("/employees/:id", allowRoles(...roles.employee), async (req, res) => {
  try {
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // ERP link: sync salary to unpaid payroll records
    if (req.body.salary !== undefined) {
      await Payroll.updateMany(
        { company: req.companyId, employee: req.params.id, paymentStatus: "Unpaid" },
        { basicSalary: req.body.salary }
      );
    }

    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: "Failed to update employee", detail: err.message });
  }
});

router.delete("/employees/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete employee", detail: err.message });
  }
});

// ── Projects ──────────────────────────────────────────────────────────────────

const projectCrud = crudRouter(Project, { createRoles: roles.project, updateRoles: roles.project, deleteRoles: ["SUPER_ADMIN"] });
router.get("/projects",        projectCrud.list);
router.post("/projects",       projectCrud.create);
router.patch("/projects/:id",  projectCrud.update);
router.delete("/projects/:id", projectCrud.remove);

// ── Payroll (with employee populated) ────────────────────────────────────────

router.get("/payroll", async (req, res) => {
  try {
    const docs = await Payroll.find({ company: req.companyId })
      .populate("employee", "firstName lastName employeeCode position department")
      .sort({ year: -1, createdAt: -1 })
      .limit(250);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payroll" });
  }
});

router.post("/payroll", allowRoles("SUPER_ADMIN", "HR_MANAGER", "ACCOUNTS_OFFICER"), async (req, res) => {
  try {
    // If employee ref given, pull salary automatically
    let payload = { ...req.body, company: req.companyId };
    if (req.body.employee && !req.body.basicSalary) {
      const emp = await Employee.findById(req.body.employee);
      if (emp) payload.basicSalary = emp.salary;
    }
    const doc = await Payroll.create(payload);
    const populated = await Payroll.findById(doc._id)
      .populate("employee", "firstName lastName employeeCode position department");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to create payroll", detail: err.message });
  }
});

router.patch("/payroll/:id", allowRoles("SUPER_ADMIN", "HR_MANAGER", "ACCOUNTS_OFFICER"), async (req, res) => {
  try {
    const doc = await Payroll.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      req.body,
      { new: true, runValidators: true }
    ).populate("employee", "firstName lastName employeeCode position department");
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to update payroll", detail: err.message });
  }
});

router.delete("/payroll/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const doc = await Payroll.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete payroll", detail: err.message });
  }
});

// ── Leave Requests (with employee populated + approval) ───────────────────────

router.get("/leave-requests", async (req, res) => {
  try {
    const query = { company: req.companyId };
    // EMPLOYEE role only sees their own leave
    if (req.user.role === "EMPLOYEE" && req.user.employee) {
      query.employee = req.user.employee._id;
    }
    const docs = await LeaveRequest.find(query)
      .populate("employee", "firstName lastName employeeCode position department")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .limit(250);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leave requests" });
  }
});

router.post("/leave-requests", async (req, res) => {
  try {
    let payload = { ...req.body, company: req.companyId };
    // If EMPLOYEE role, auto-assign their own employee record
    if (req.user.role === "EMPLOYEE" && req.user.employee) {
      payload.employee = req.user.employee._id;
    }
    const doc = await LeaveRequest.create(payload);
    const populated = await LeaveRequest.findById(doc._id)
      .populate("employee", "firstName lastName employeeCode position department")
      .populate("approvedBy", "name");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to create leave request", detail: err.message });
  }
});

// Approve / Reject leave
router.patch("/leave-requests/:id/approve", allowRoles("SUPER_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const { status } = req.body; // "Approved" | "Rejected"
    if (!["Approved", "Rejected"].includes(status))
      return res.status(400).json({ message: "Status must be Approved or Rejected" });

    const doc = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { status, approvedBy: req.user._id },
      { new: true }
    ).populate("employee", "firstName lastName employeeCode")
     .populate("approvedBy", "name");

    if (!doc) return res.status(404).json({ message: "Leave request not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to update leave request", detail: err.message });
  }
});

router.patch("/leave-requests/:id", allowRoles("SUPER_ADMIN", "HR_MANAGER", "EMPLOYEE"), async (req, res) => {
  try {
    const doc = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      req.body,
      { new: true, runValidators: true }
    ).populate("employee", "firstName lastName employeeCode position department")
     .populate("approvedBy", "name");
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to update leave request", detail: err.message });
  }
});

router.delete("/leave-requests/:id", allowRoles("SUPER_ADMIN", "HR_MANAGER"), async (req, res) => {
  try {
    const doc = await LeaveRequest.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete leave request", detail: err.message });
  }
});

// ── Timesheets (with populated fields + approval) ─────────────────────────────

router.get("/timesheets", async (req, res) => {
  try {
    const query = { company: req.companyId };
    if (req.user.role === "EMPLOYEE" && req.user.employee) {
      query.employee = req.user.employee._id;
    }
    const docs = await Timesheet.find(query)
      .populate("employee", "firstName lastName employeeCode")
      .populate("project", "projectName projectCode")
      .populate("approvedBy", "name")
      .sort({ date: -1 })
      .limit(250);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch timesheets" });
  }
});

router.post("/timesheets", allowRoles(...roles.supervisor, "EMPLOYEE"), async (req, res) => {
  try {
    let payload = { ...req.body, company: req.companyId };
    if (req.user.role === "EMPLOYEE" && req.user.employee) {
      payload.employee = req.user.employee._id;
    }
    const doc = await Timesheet.create(payload);
    const populated = await Timesheet.findById(doc._id)
      .populate("employee", "firstName lastName employeeCode")
      .populate("project", "projectName projectCode")
      .populate("approvedBy", "name");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to create timesheet", detail: err.message });
  }
});

router.patch("/timesheets/:id/approve", allowRoles("SUPER_ADMIN", "PROJECT_MANAGER", "SITE_SUPERVISOR"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected"].includes(status))
      return res.status(400).json({ message: "Status must be Approved or Rejected" });

    const doc = await Timesheet.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      { status, approvedBy: req.user._id },
      { new: true }
    ).populate("employee", "firstName lastName employeeCode")
     .populate("project", "projectName projectCode")
     .populate("approvedBy", "name");

    if (!doc) return res.status(404).json({ message: "Timesheet not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to approve timesheet", detail: err.message });
  }
});

router.patch("/timesheets/:id", allowRoles(...roles.supervisor), async (req, res) => {
  try {
    const doc = await Timesheet.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      req.body,
      { new: true, runValidators: true }
    ).populate("employee", "firstName lastName employeeCode")
     .populate("project", "projectName projectCode")
     .populate("approvedBy", "name");
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to update timesheet", detail: err.message });
  }
});

router.delete("/timesheets/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const doc = await Timesheet.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete timesheet", detail: err.message });
  }
});

// ── Expenses (with project populated) ────────────────────────────────────────

router.get("/expenses", async (req, res) => {
  try {
    const docs = await Expense.find({ company: req.companyId })
      .populate("project", "projectName projectCode")
      .populate("recordedBy", "name")
      .sort({ expenseDate: -1 })
      .limit(250);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

router.post("/expenses", allowRoles(...roles.accounts), async (req, res) => {
  try {
    const doc = await Expense.create({ ...req.body, company: req.companyId, recordedBy: req.user._id });
    const populated = await Expense.findById(doc._id)
      .populate("project", "projectName projectCode")
      .populate("recordedBy", "name");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to create expense", detail: err.message });
  }
});

router.patch("/expenses/:id", allowRoles(...roles.accounts), async (req, res) => {
  try {
    const doc = await Expense.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      req.body,
      { new: true, runValidators: true }
    ).populate("project", "projectName projectCode").populate("recordedBy", "name");
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to update expense", detail: err.message });
  }
});

router.delete("/expenses/:id", allowRoles("SUPER_ADMIN"), async (req, res) => {
  try {
    const doc = await Expense.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete expense", detail: err.message });
  }
});

// ── Assets ────────────────────────────────────────────────────────────────────

const assetCrud = crudRouter(Asset, {
  createRoles: ["SUPER_ADMIN", "PROJECT_MANAGER", "ACCOUNTS_OFFICER", "DATA_CLERK"],
  updateRoles: ["SUPER_ADMIN", "PROJECT_MANAGER", "ACCOUNTS_OFFICER", "DATA_CLERK"],
  deleteRoles: ["SUPER_ADMIN"]
});
router.get("/assets",        assetCrud.list);
router.post("/assets",       assetCrud.create);
router.patch("/assets/:id",  assetCrud.update);
router.delete("/assets/:id", assetCrud.remove);

router.post("/assets/:id/assignments", async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    asset.assignments.push({ ...req.body, assignedBy: req.user._id });
    asset.status = "Assigned";
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ message: "Failed to add assignment", detail: err.message });
  }
});

router.post("/assets/:id/maintenance", async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    asset.maintenance.push({ ...req.body, recordedBy: req.user._id });
    if (req.body.maintenanceType === "Repair") asset.status = "Under Maintenance";
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ message: "Failed to add maintenance", detail: err.message });
  }
});

router.post("/assets/:id/fuel-logs", async (req, res) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, company: req.companyId });
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    asset.fuelLogs.push({ ...req.body, recordedBy: req.user._id });
    await asset.save();
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ message: "Failed to add fuel log", detail: err.message });
  }
});

export default router;
