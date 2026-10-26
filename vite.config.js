import { defineConfig } from "vite";

// GitHub Pages serves the app at /liftboard/; Vercel and local dev serve it at /.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/liftboard/" : "/",
});
