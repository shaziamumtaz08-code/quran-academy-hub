import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { userClient } from "./get-my-profile";

export default defineTool({
  name: "list_my_courses",
  title: "List my courses",
  description: "List courses the signed-in user is enrolled in or teaching. Row visibility follows the app's access rules.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Maximum rows to return. Default 25."),
    status: z.string().optional().describe("Optional status filter (e.g. active, completed)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = userClient(ctx);
    let q = sb
      .from("courses")
      .select("id, name, status, division_id, teacher_id, start_date, end_date, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { courses: data ?? [] },
    };
  },
});
