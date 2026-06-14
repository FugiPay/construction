import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    assignedFrom: Date,
    assignedTo: Date,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const maintenanceSchema = new mongoose.Schema(
  {
    maintenanceType: { type: String, enum: ["Service", "Repair", "Inspection"], required: true },
    description: String,
    maintenanceDate: Date,
    cost: { type: Number, default: 0 },
    nextServiceDate: Date,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const fuelLogSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    fuelDate: Date,
    litres: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const assetSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    assetCode: { type: String, required: true },
    assetName: { type: String, required: true },
    category: {
      type: String,
      enum: ["Vehicles", "Heavy Equipment", "Tools", "Office Equipment", "IT Equipment", "Leased Equipment"],
      required: true
    },
    purchaseDate: Date,
    purchaseCost: { type: Number, default: 0 },
    serialNumber: String,
    registrationNumber: String,
    warrantyExpiry: Date,
    condition: { type: String, enum: ["Excellent", "Good", "Fair", "Needs Repair"], default: "Good" },
    status: { type: String, enum: ["Available", "Assigned", "Under Maintenance", "Disposed"], default: "Available" },
    currentLocation: String,
    notes: String,
    assignments: [assignmentSchema],
    maintenance: [maintenanceSchema],
    fuelLogs: [fuelLogSchema]
  },
  { timestamps: true }
);

assetSchema.index({ company: 1, assetCode: 1 }, { unique: true });

export default mongoose.model("Asset", assetSchema);
