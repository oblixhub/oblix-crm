import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // A relative root works locally and in Vercel without relying on Node globals
    // in this TypeScript configuration file.
    var env = loadEnv(mode, ".", "VITE_");
    return {
        plugins: [react()],
        define: {
            "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
            "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
        },
    };
});
