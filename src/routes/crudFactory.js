export function crudRouter(Model, options = {}) {
  const { createRoles = [], updateRoles = [], deleteRoles = [] } = options;

  return {
    async list(req, res) {
      const docs = await Model.find({ company: req.companyId }).sort({ createdAt: -1 }).limit(250);
      res.json(docs);
    },
    async create(req, res) {
      if (createRoles.length && !createRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
      }
      const doc = await Model.create({ ...req.body, company: req.companyId, recordedBy: req.user._id });
      res.status(201).json(doc);
    },
    async update(req, res) {
      if (updateRoles.length && !updateRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
      }
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, company: req.companyId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!doc) return res.status(404).json({ message: "Record not found" });
      res.json(doc);
    },
    async remove(req, res) {
      if (deleteRoles.length && !deleteRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Permission denied" });
      }
      const doc = await Model.findOneAndDelete({ _id: req.params.id, company: req.companyId });
      if (!doc) return res.status(404).json({ message: "Record not found" });
      res.status(204).end();
    }
  };
}
