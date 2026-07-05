import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { userClient } from "./get-my-profile";

export default defineTool({
  name: "list_my_schedule",
  title: "List my weekly schedule",
  description: "List the signed-in user's weekly class schedule entries. Row visibility follows the app's access rules.",
  inputSchema: {
    day_of_week: z
      .enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
      .optional()
      .describe("Optional filter for a specific weekday."),
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows to return. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ day_of_week, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = userClient(ctx);
    let q = sb
      .from("schedules")
      .select("id, day_of_week, teacher_local_time, student_local_time, duration_minutes, is_active, assignment_id, course_id")
      .eq("is_active", true)
      .order("day_of_week")
      .order("teacher_local_time")
      .limit(limit ?? 50);
    if (day_of_week) q = q.eq("day_of_week", day_of_week);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { schedules: data ?? [] },
    };
  },
});
