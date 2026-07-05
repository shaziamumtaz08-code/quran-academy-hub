import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getMyProfileTool from "./tools/get-my-profile";
import listMyCoursesTool from "./tools/list-my-courses";
import listMyScheduleTool from "./tools/list-my-schedule";
import listMyStudentsTool from "./tools/list-my-students";

// Build the OAuth issuer from the Supabase project ref (inlined by Vite at
// build time, so this stays import-safe — no runtime env read at module top).
// Must be the direct supabase.co host: mcp-js rejects any token whose issuer
// does not match what the discovery document publishes (RFC 8414 §3.3).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "aqt-lms-mcp",
  title: "Al Quran Time Academy LMS",
  version: "0.1.0",
  instructions:
    "Tools for the Al Quran Time Academy LMS. Every tool runs as the signed-in user, so results respect the app's role and division access rules. Use `echo` to verify connectivity, `get_my_profile` to identify the current user, `list_my_courses` / `list_my_schedule` / `list_my_students` to read the user's own academic data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getMyProfileTool,
    listMyCoursesTool,
    listMyScheduleTool,
    listMyStudentsTool,
  ],
});
