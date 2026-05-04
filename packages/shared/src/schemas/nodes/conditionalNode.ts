import { z } from "zod";

export const ConditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "is_empty",
  "is_not_empty",
  "regex",
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const DataTypeSchema = z.enum(["string", "number", "boolean", "array", "date"]);
export type DataType = z.infer<typeof DataTypeSchema>;

export const ConditionSchema = z.object({
  field:    z.string().min(1),
  operator: ConditionOperatorSchema,
  value:    z.unknown().optional(),
  dataType: DataTypeSchema.optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const CombinatorSchema = z.enum(["and", "or"]);
export type Combinator = z.infer<typeof CombinatorSchema>;

export const IfNodeConfigSchema = z.object({
  mode:       z.literal("if"),
  combinator: CombinatorSchema.default("and"),
  conditions: z.array(ConditionSchema).min(1),
});
export type IfNodeConfig = z.infer<typeof IfNodeConfigSchema>;

export const SwitchRuleSchema = z.object({
  label:      z.string(),
  combinator: CombinatorSchema.default("and"),
  conditions: z.array(ConditionSchema),
});
export type SwitchRule = z.infer<typeof SwitchRuleSchema>;

export const SwitchNodeConfigSchema = z.object({
  mode:               z.literal("switch"),
  rules:              z.array(SwitchRuleSchema).min(1),
  defaultBranchIndex: z.number().int().min(0).optional(),
});
export type SwitchNodeConfig = z.infer<typeof SwitchNodeConfigSchema>;

export const ConditionalNodeConfigSchema = z.discriminatedUnion("mode", [
  IfNodeConfigSchema,
  SwitchNodeConfigSchema,
]);
export type ConditionalNodeConfig = z.infer<typeof ConditionalNodeConfigSchema>;
