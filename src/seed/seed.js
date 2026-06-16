import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import Asset from "../models/Asset.js";
import Company from "../models/Company.js";
import Employee from "../models/Employee.js";
import Expense from "../models/Expense.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Payroll from "../models/Payroll.js";
import Project from "../models/Project.js";
import Timesheet from "../models/Timesheet.js";
import User from "../models/User.js";

dotenv.config();

await connectDb();
await Promise.all([
  Asset.deleteMany({}),
  Company.deleteMany({}),
  Employee.deleteMany({}),
  Expense.deleteMany({}),
  LeaveRequest.deleteMany({}),
  Payroll.deleteMany({}),
  Project.deleteMany({}),
  Timesheet.deleteMany({}),
  User.deleteMany({})
]);

const company = await Company.create({
  name: "Peculiar Construction Limited",
  registrationNumber: "CO-2026-001",
  domain: "peculiar.co.zm",
  address: "Lusaka, Zambia",
  phone: "+260 970 000 000"
});

const employees = await Employee.insertMany([
  {
    company,
    employeeCode: "EMP-001",
    firstName: "Martha",
    lastName: "Phiri",
    nrc: "111111/11/1",
    phone: "+260 971 111 111",
    email: "martha@coms.local",
    position: "HR Manager",
    department: "Human Resources",
    employmentType: "Permanent",
    salary: 14500,
    dateHired: "2024-02-01"
  },
  {
    company,
    employeeCode: "EMP-002",
    firstName: "Brian",
    lastName: "Mwansa",
    phone: "+260 972 222 222",
    email: "brian@coms.local",
    position: "Project Manager",
    department: "Operations",
    employmentType: "Permanent",
    salary: 21000,
    dateHired: "2023-08-15"
  },
  {
    company,
    employeeCode: "EMP-003",
    firstName: "Grace",
    lastName: "Banda",
    phone: "+260 973 333 333",
    email: "grace@coms.local",
    position: "Accounts Officer",
    department: "Finance",
    employmentType: "Permanent",
    salary: 16000,
    dateHired: "2024-05-20"
  },
  {
    company,
    employeeCode: "EMP-004",
    firstName: "Kelvin",
    lastName: "Sakala",
    phone: "+260 974 444 444",
    email: "kelvin@coms.local",
    position: "Site Supervisor",
    department: "Site Operations",
    employmentType: "Contract",
    salary: 9800,
    dateHired: "2025-01-10"
  }
]);

// ✅ User.create() triggers pre('save') so passwords are properly hashed
const users = await Promise.all([
  User.create({ company, name: "System Admin",   email: "admin@coms.local",      password: "Password123!", role: "SUPER_ADMIN" }),
  User.create({ company, name: "Martha Phiri",   email: "hr@coms.local",         password: "Password123!", role: "HR_MANAGER",       employee: employees[0]._id }),
  User.create({ company, name: "Brian Mwansa",   email: "pm@coms.local",         password: "Password123!", role: "PROJECT_MANAGER",  employee: employees[1]._id }),
  User.create({ company, name: "Grace Banda",    email: "accounts@coms.local",   password: "Password123!", role: "ACCOUNTS_OFFICER", employee: employees[2]._id }),
  User.create({ company, name: "Kelvin Sakala",  email: "supervisor@coms.local", password: "Password123!", role: "SITE_SUPERVISOR",  employee: employees[3]._id }),
  User.create({ company, name: "Employee Demo",  email: "employee@coms.local",   password: "Password123!", role: "EMPLOYEE",         employee: employees[3]._id }),
]);

const projects = await Project.insertMany([
  {
    company,
    projectCode: "PRJ-001",
    projectName: "Chilenje Clinic Expansion",
    clientName: "Lusaka City Council",
    startDate: "2026-01-15",
    endDate: "2026-09-30",
    budget: 1250000,
    status: "Ongoing",
    projectManager: employees[1]._id,
    employees: [
      { employee: employees[1]._id, assignedFrom: "2026-01-15", hourlyRate: 120 },
      { employee: employees[3]._id, assignedFrom: "2026-01-20", hourlyRate: 75 }
    ]
  },
  {
    company,
    projectCode: "PRJ-002",
    projectName: "Ndola Warehouse Fit-Out",
    clientName: "Copperbelt Logistics",
    startDate: "2025-10-01",
    endDate: "2026-03-30",
    budget: 740000,
    status: "Completed",
    projectManager: employees[1]._id
  }
]);

await Expense.insertMany([
  { company, project: projects[0]._id, expenseCategory: "Material",    description: "Cement and blocks",       amount: 182000, expenseDate: "2026-02-03", recordedBy: users[3]._id },
  { company, project: projects[0]._id, expenseCategory: "Fuel",        description: "Tipper truck diesel",     amount: 26500,  expenseDate: "2026-02-12", recordedBy: users[3]._id },
  { company, project: projects[1]._id, expenseCategory: "Subcontract", description: "Electrical contractor",   amount: 118000, expenseDate: "2026-01-22", recordedBy: users[3]._id }
]);

await Asset.insertMany([
  {
    company,
    assetCode: "AST-001",
    assetName: "Toyota Hilux Pickup",
    category: "Vehicles",
    purchaseCost: 430000,
    registrationNumber: "BAL 2045",
    condition: "Good",
    status: "Assigned",
    currentLocation: "Chilenje Site",
    assignments: [{ project: projects[0]._id, assignedFrom: "2026-01-16", assignedBy: users[2]._id }],
    fuelLogs:    [{ project: projects[0]._id, fuelDate: "2026-02-12", litres: 120, cost: 26500, recordedBy: users[4]._id }]
  },
  {
    company,
    assetCode: "AST-002",
    assetName: "Concrete Mixer",
    category: "Heavy Equipment",
    purchaseCost: 86000,
    serialNumber: "MIX-4491",
    condition: "Fair",
    status: "Under Maintenance",
    currentLocation: "Workshop",
    maintenance: [{ maintenanceType: "Repair", description: "Motor replacement", maintenanceDate: "2026-02-18", cost: 7200, recordedBy: users[4]._id }]
  }
]);

await LeaveRequest.create({
  company,
  employee: employees[3]._id,
  leaveType: "Annual",
  startDate: "2026-07-08",
  endDate: "2026-07-12",
  daysRequested: 5,
  reason: "Family commitments"
});

await Payroll.insertMany(
  employees.map((e) => ({
    company,
    employee: e._id,
    month: "June",
    year: 2026,
    basicSalary: e.salary,
    allowances: 1200,
    deductions: 900,
    paymentStatus: e.employeeCode === "EMP-004" ? "Unpaid" : "Paid"
  }))
);

await Timesheet.insertMany([
  { company, employee: employees[3]._id, project: projects[0]._id, date: "2026-06-10", normalHours: 8, overtimeHours: 2, status: "Approved", approvedBy: users[2]._id },
  { company, employee: employees[1]._id, project: projects[0]._id, date: "2026-06-10", normalHours: 8, overtimeHours: 0, status: "Approved", approvedBy: users[2]._id }
]);

console.log("✅ Seed complete!");
console.log("────────────────────────────────────────");
console.log("Login credentials:");
console.log("  admin@coms.local       / Password123!  (Super Admin)");
console.log("  hr@coms.local          / Password123!  (HR Manager)");
console.log("  pm@coms.local          / Password123!  (Project Manager)");
console.log("  accounts@coms.local    / Password123!  (Accounts Officer)");
console.log("  supervisor@coms.local  / Password123!  (Site Supervisor)");
console.log("  employee@coms.local    / Password123!  (Employee)");
console.log("────────────────────────────────────────");

await mongoose.disconnect();
