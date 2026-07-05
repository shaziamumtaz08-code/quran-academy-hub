import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { userClient } from "./get-my-profile";

export default defineTool({
  name: "list_my_students",
  title: "List my students",
  description: "For a signed-in teacher, list active student-teacher assignments. Row visibility follows the app's access rules.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows to return. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = userClient(ctx);
    const { data, error } = await sb
      .from("student_teacher_assignments")
      .select("id, student_id, teacher_id, subject_id, status, duration_minutes, start_date, division_id, branch_id")
      .eq("teacher_id", ctx.getUserId())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { assignments: data ?? [] },
    };
  },
});
