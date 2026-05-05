import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true },
    description: { type: String, default: "" },
    category:    { type: String, required: true },
    nodes:       { type: Array, default: [] },
    edges:       { type: Array, default: [] },
    thumbnail:   { type: String },
    author:      { type: String, required: true },
    tags:        { type: [String], default: [] },
    usageCount:  { type: Number, default: 0 },
    rating:      { type: Number, default: 0 },
    isPublic:    { type: Boolean, default: true },
    /** null = platform-wide template; set = tenant's private template */
    tenantId:    { type: String, default: null },
  },
  { timestamps: true }
);

templateSchema.index({ isPublic: 1, category: 1 });
templateSchema.index({ tenantId: 1 });
templateSchema.index({ name: "text", description: "text" });

export const TemplateModel =
  (mongoose.models["Template"] as ReturnType<typeof mongoose.model>) ??
  mongoose.model("Template", templateSchema);
