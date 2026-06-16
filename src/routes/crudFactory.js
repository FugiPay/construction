export function crudRouter(Model, options = {}) {
  const { createRoles = [], updateRoles = [], deleteRoles = [] } = options;

  return {
    async list(req, res) {
      try {
        const docs = await Model.find({ company: req.companyId }).sort({ createdAt: -1 }).limit(250);
        res.json(docs);
      } catch (err) {
        res.status(500).json({ message: "Failed to fetch records", detail: err.message });
      }
    },

    async create(req, res) {
      try {
        if (createRoles.length && !createRoles.includes(req.user.role))
          return res.status(403).json({ message: "Permission denied" });

        const doc = await Model.create({ ...req.body, company: req.companyId, recordedBy: req.user._id });
        res.status(201).json(doc);
      } catch (err) {
        if (err.code === 11000) {
          const field = Object.keys(err.keyPattern || {})[0] || "field";
          return res.status(409).json({ message: `A record with this ${field} already exists` });
        }
        if (err.name === "ValidationError") {
          const messages = Object.values(err.errors).map(e => e.message).join(", ");
          return res.status(400).json({ message: messages });
        }
        res.status(500).json({ message: "Failed to create record", detail: err.message });
      }
    },

    async update(req, res) {
      try {
        if (updateRoles.length && !updateRoles.includes(req.user.role))
          return res.status(403).json({ message: "Permission denied" });

        const doc = await Model.findOneAndUpdate(
          { _id: req.params.id, company: req.companyId },
          req.body,
          { new: true, runValidators: true }
        );
        if (!doc) return res.status(404).json({ message: "Record not found" });
        res.json(doc);
      } catch (err) {
        if (err.name === "ValidationError") {
          const messages = Object.values(err.errors).map(e => e.message).join(", ");
          return res.status(400).json({ message: messages });
        }
        res.status(500).json({ message: "Failed to update record", detail: err.message });
      }
    },

    async remove(req, res) {
      try {
        if (deleteRoles.length && !deleteRoles.includes(req.user.role))
          return res.status(403).json({ message: "Permission denied" });

        const doc = await Model.findOneAndDelete({ _id: req.params.id, company: req.companyId });
        if (!doc) return res.status(404).json({ message: "Record not found" });
        res.status(204).end();
      } catch (err) {
        res.status(500).json({ message: "Failed to delete record", detail: err.message });
      }
    }
  };
}
