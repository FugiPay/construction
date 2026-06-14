import express from "express";
import Asset from "../models/Asset.js";
import Employee from "../models/Employee.js";
import Expense from "../models/Expense.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Payroll from "../models/Payroll.js";
import Project from "../models/Project.js";
import Timesheet from "../models/Timesheet.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const company = req.companyId;
  const [employees, projects, assets, pendingLeave, unpaidPayroll, expenseTotals, payrollTotals, timesheets] =
    await Promise.all([
      Employee.countDocuments({ company, status: "Active" }),
      Project.find({ company }).lean(),
      Asset.find({ company }).lean(),
      LeaveRequest.countDocuments({ company, status: "Pending" }),
      Payroll.countDocuments({ company, paymentStatus: "Unpaid" }),
      Expense.aggregate([{ $match: { company } }, { $group: { _id: "$project", total: { $sum: "$amount" } } }]),
      Payroll.aggregate([{ $match: { company } }, { $group: { _id: null, total: { $sum: "$netPay" } } }]),
      Timesheet.find({ company }).lean()
    ]);

  const expenseByProject = Object.fromEntries(expenseTotals.map((item) => [String(item._id), item.total]));
  const projectCards = projects.map((project) => ({
    id: project._id,
    name: project.projectName,
    client: project.clientName,
    status: project.status,
    budget: project.budget,
    spent: expenseByProject[String(project._id)] || 0,
    variance: project.budget - (expenseByProject[String(project._id)] || 0)
  }));

  const labourHours = timesheets.reduce(
    (sum, row) => sum + row.normalHours + row.overtimeHours * 1.5 + row.doubleOvertimeHours * 2,
    0
  );

  res.json({
    metrics: {
      activeEmployees: employees,
      activeProjects: projects.filter((project) => project.status === "Ongoing").length,
      availableAssets: assets.filter((asset) => asset.status === "Available").length,
      pendingLeave,
      unpaidPayroll,
      totalPayroll: payrollTotals[0]?.total || 0,
      labourHours
    },
    projects: projectCards,
    assetCondition: assets.reduce((acc, asset) => {
      acc[asset.condition] = (acc[asset.condition] || 0) + 1;
      return acc;
    }, {})
  });
});

router.get("/reports", async (req, res) => {
  const company = req.companyId;
  const [leave, payroll, expenses, projects, assets] = await Promise.all([
    LeaveRequest.find({ company }).populate("employee", "firstName lastName employeeCode"),
    Payroll.find({ company }).populate("employee", "firstName lastName employeeCode"),
    Expense.find({ company }).populate("project", "projectName projectCode"),
    Project.find({ company }).populate("employees.employee", "firstName lastName employeeCode"),
    Asset.find({ company })
  ]);

  res.json({
    employeeLeaveSummary: leave,
    monthlyPayrollReport: payroll,
    projectExpenseSummary: expenses,
    budgetVsActualCost: projects.map((project) => {
      const spent = expenses
        .filter((expense) => String(expense.project?._id) === String(project._id))
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { project: project.projectName, budget: project.budget, spent, variance: project.budget - spent };
    }),
    employeeAllocationPerProject: projects.map((project) => ({
      project: project.projectName,
      employees: project.employees
    })),
    activeVsCompletedProjects: {
      active: projects.filter((project) => project.status === "Ongoing").length,
      completed: projects.filter((project) => project.status === "Completed").length
    },
    assetConditionSummary: assets.reduce((acc, asset) => {
      acc[asset.condition] = (acc[asset.condition] || 0) + 1;
      return acc;
    }, {})
  });
});

export default router;
