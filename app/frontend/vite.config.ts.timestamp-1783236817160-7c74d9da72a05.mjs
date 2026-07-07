// vite.config.ts
import { defineConfig } from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/@vitejs/plugin-react-swc/index.js";
import fs3 from "node:fs";
import path4 from "path";
import { viteSourceLocator } from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/@metagptx/vite-plugin-source-locator/dist/index.mjs";
import { atoms } from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/@metagptx/web-sdk/dist/plugins.js";
import { vitePrerenderPlugin } from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/vite-prerender-plugin/src/index.js";
import Sitemap from "file:///D:/code/Agent%20Diplomacy/app/frontend/node_modules/vite-plugin-sitemap/dist/index.js";

// prerender/blog-routes.js
import path2 from "node:path";

// prerender/utils.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/code/Agent%20Diplomacy/app/frontend/prerender/utils.js";
var currentFile = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname2 = path.dirname(currentFile);
var projectRoot = path.resolve(__dirname2, "..");
var seoContentDir = path.resolve(projectRoot, "seo", "content");
function normalizeRouteFromMarkdown(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/index\.md$/, "").replace(/\.md$/, "");
  return normalized ? `/blog/${normalized}/` : "/blog/";
}
function collectMarkdownFiles(dir, bucket = []) {
  if (!fs.existsSync(dir)) {
    return bucket;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, bucket);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      bucket.push(fullPath);
    }
  }
  return bucket;
}

// prerender/blog-routes.js
function getBlogRoutes() {
  const routes = /* @__PURE__ */ new Set(["/blog/"]);
  for (const filePath of collectMarkdownFiles(seoContentDir)) {
    const relativePath = path2.relative(seoContentDir, filePath);
    routes.add(normalizeRouteFromMarkdown(relativePath));
  }
  return Array.from(routes).sort();
}

// prerender/blog-sitemap.js
import fs2 from "node:fs";
import path3 from "node:path";
function collectMarkdownLastmod(dir) {
  const bucket = {};
  for (const fullPath of collectMarkdownFiles(dir)) {
    const relativePath = path3.relative(seoContentDir, fullPath);
    const route = normalizeRouteFromMarkdown(relativePath);
    bucket[route] = fs2.statSync(fullPath).mtime;
  }
  return bucket;
}
function getLatestContentMtime(lastmodMap) {
  const dates = Object.values(lastmodMap).filter((value) => value instanceof Date);
  if (dates.length === 0) {
    return void 0;
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
function getSitemapLastmod() {
  const contentLastmod = collectMarkdownLastmod(seoContentDir);
  const latestContentMtime = getLatestContentMtime(contentLastmod);
  return {
    ...latestContentMtime ? { "/blog/": latestContentMtime } : {},
    ...contentLastmod
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "D:\\code\\Agent Diplomacy\\app\\frontend";
function escapeHtmlAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
process.env.VITE_APP_TITLE ??= process.env.OVERVIEW_TITLE ?? "Agent Diplomacy";
process.env.VITE_APP_DESCRIPTION ??= process.env.OVERVIEW_DESCRIPTION ?? "A multi-agent diplomacy strategy sandbox.";
process.env.VITE_APP_TITLE = escapeHtmlAttr(process.env.VITE_APP_TITLE);
process.env.VITE_APP_DESCRIPTION = escapeHtmlAttr(process.env.VITE_APP_DESCRIPTION);
process.env.VITE_APP_LOGO_URL ??= process.env.OVERVIEW_LOGO_URL ?? "https://public-frontend-cos.metadl.com/mgx/img/favicon_atoms.ico";
function ensureBuildOutDir() {
  let outDir = path4.resolve(__vite_injected_original_dirname, "dist");
  return {
    name: "ensure-build-out-dir",
    configResolved(config) {
      outDir = path4.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      fs3.mkdirSync(outDir, { recursive: true });
    }
  };
}
var vite_config_default = defineConfig(({ command }) => {
  const blogPrerenderRoutes = command === "build" ? getBlogRoutes() : [];
  return {
    plugins: [
      viteSourceLocator({
        prefix: "mgx"
        // Prefix used to identify source locations; do not change.
      }),
      react(),
      atoms(),
      ensureBuildOutDir(),
      Sitemap({
        hostname: "https://example.com",
        lastmod: getSitemapLastmod(),
        readable: true,
        generateRobotsTxt: true
      }),
      ...blogPrerenderRoutes.length > 0 ? vitePrerenderPlugin({
        renderTarget: "#root",
        prerenderScript: path4.resolve(__vite_injected_original_dirname, "prerender/blog.js"),
        additionalPrerenderRoutes: blogPrerenderRoutes
      }) : []
    ],
    resolve: {
      alias: {
        "@": path4.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    server: {
      host: "0.0.0.0",
      // Listen on all network interfaces.
      port: parseInt(process.env.VITE_PORT || "3000"),
      proxy: {
        "/api": {
          target: `http://localhost:${process.env.BACKEND_PORT || "8000"}`,
          changeOrigin: true
        }
      },
      watch: { usePolling: true, interval: 600 }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            "react-vendor": ["react", "react-dom"],
            "router-vendor": ["react-router-dom"],
            "ui-vendor": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-aspect-ratio",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip"
            ],
            "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
            "utils-vendor": [
              "axios",
              "clsx",
              "tailwind-merge",
              "class-variance-authority",
              "date-fns",
              "lucide-react"
            ],
            "query-vendor": ["@tanstack/react-query"]
          }
        }
      },
      chunkSizeWarningLimit: 1e3
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicHJlcmVuZGVyL2Jsb2ctcm91dGVzLmpzIiwgInByZXJlbmRlci91dGlscy5qcyIsICJwcmVyZW5kZXIvYmxvZy1zaXRlbWFwLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcY29kZVxcXFxBZ2VudCBEaXBsb21hY3lcXFxcYXBwXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxjb2RlXFxcXEFnZW50IERpcGxvbWFjeVxcXFxhcHBcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L2NvZGUvQWdlbnQlMjBEaXBsb21hY3kvYXBwL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgdml0ZVNvdXJjZUxvY2F0b3IgfSBmcm9tICdAbWV0YWdwdHgvdml0ZS1wbHVnaW4tc291cmNlLWxvY2F0b3InO1xuaW1wb3J0IHsgYXRvbXMgfSBmcm9tICdAbWV0YWdwdHgvd2ViLXNkay9wbHVnaW5zJztcbmltcG9ydCB7IHZpdGVQcmVyZW5kZXJQbHVnaW4gfSBmcm9tICd2aXRlLXByZXJlbmRlci1wbHVnaW4nO1xuaW1wb3J0IFNpdGVtYXAgZnJvbSAndml0ZS1wbHVnaW4tc2l0ZW1hcCc7XG5pbXBvcnQgeyBnZXRCbG9nUm91dGVzIH0gZnJvbSAnLi9wcmVyZW5kZXIvYmxvZy1yb3V0ZXMuanMnO1xuaW1wb3J0IHsgZ2V0U2l0ZW1hcExhc3Rtb2QgfSBmcm9tICcuL3ByZXJlbmRlci9ibG9nLXNpdGVtYXAuanMnO1xuXG5mdW5jdGlvbiBlc2NhcGVIdG1sQXR0cihzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHJcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xufVxuXG5wcm9jZXNzLmVudi5WSVRFX0FQUF9USVRMRSA/Pz0gcHJvY2Vzcy5lbnYuT1ZFUlZJRVdfVElUTEUgPz8gJ0FnZW50IERpcGxvbWFjeSc7XG5wcm9jZXNzLmVudi5WSVRFX0FQUF9ERVNDUklQVElPTiA/Pz1cbiAgcHJvY2Vzcy5lbnYuT1ZFUlZJRVdfREVTQ1JJUFRJT04gPz8gJ0EgbXVsdGktYWdlbnQgZGlwbG9tYWN5IHN0cmF0ZWd5IHNhbmRib3guJztcbnByb2Nlc3MuZW52LlZJVEVfQVBQX1RJVExFID0gZXNjYXBlSHRtbEF0dHIocHJvY2Vzcy5lbnYuVklURV9BUFBfVElUTEUpO1xucHJvY2Vzcy5lbnYuVklURV9BUFBfREVTQ1JJUFRJT04gPSBlc2NhcGVIdG1sQXR0cihwcm9jZXNzLmVudi5WSVRFX0FQUF9ERVNDUklQVElPTik7XG5wcm9jZXNzLmVudi5WSVRFX0FQUF9MT0dPX1VSTCA/Pz0gcHJvY2Vzcy5lbnYuT1ZFUlZJRVdfTE9HT19VUkwgPz8gJ2h0dHBzOi8vcHVibGljLWZyb250ZW5kLWNvcy5tZXRhZGwuY29tL21neC9pbWcvZmF2aWNvbl9hdG9tcy5pY28nO1xuXG5mdW5jdGlvbiBlbnN1cmVCdWlsZE91dERpcigpIHtcbiAgbGV0IG91dERpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0Jyk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnZW5zdXJlLWJ1aWxkLW91dC1kaXInLFxuICAgIGNvbmZpZ1Jlc29sdmVkKGNvbmZpZykge1xuICAgICAgb3V0RGlyID0gcGF0aC5yZXNvbHZlKGNvbmZpZy5yb290LCBjb25maWcuYnVpbGQub3V0RGlyKTtcbiAgICB9LFxuICAgIHdyaXRlQnVuZGxlKCkge1xuICAgICAgZnMubWtkaXJTeW5jKG91dERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kIH0pID0+IHtcbiAgY29uc3QgYmxvZ1ByZXJlbmRlclJvdXRlcyA9IGNvbW1hbmQgPT09ICdidWlsZCcgPyBnZXRCbG9nUm91dGVzKCkgOiBbXTtcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtcbiAgICAgIHZpdGVTb3VyY2VMb2NhdG9yKHtcbiAgICAgICAgcHJlZml4OiAnbWd4JywgLy8gUHJlZml4IHVzZWQgdG8gaWRlbnRpZnkgc291cmNlIGxvY2F0aW9uczsgZG8gbm90IGNoYW5nZS5cbiAgICAgIH0pLFxuICAgICAgcmVhY3QoKSxcbiAgICAgIGF0b21zKCksXG4gICAgICBlbnN1cmVCdWlsZE91dERpcigpLFxuICAgICAgU2l0ZW1hcCh7XG4gICAgICAgIGhvc3RuYW1lOiAnaHR0cHM6Ly9leGFtcGxlLmNvbScsXG4gICAgICAgIGxhc3Rtb2Q6IGdldFNpdGVtYXBMYXN0bW9kKCksXG4gICAgICAgIHJlYWRhYmxlOiB0cnVlLFxuICAgICAgICBnZW5lcmF0ZVJvYm90c1R4dDogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICAgLi4uKGJsb2dQcmVyZW5kZXJSb3V0ZXMubGVuZ3RoID4gMFxuICAgICAgICA/IHZpdGVQcmVyZW5kZXJQbHVnaW4oe1xuICAgICAgICAgICAgcmVuZGVyVGFyZ2V0OiAnI3Jvb3QnLFxuICAgICAgICAgICAgcHJlcmVuZGVyU2NyaXB0OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAncHJlcmVuZGVyL2Jsb2cuanMnKSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcmVyZW5kZXJSb3V0ZXM6IGJsb2dQcmVyZW5kZXJSb3V0ZXMsXG4gICAgICAgICAgfSlcbiAgICAgICAgOiBbXSksXG4gICAgXSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgaG9zdDogJzAuMC4wLjAnLCAvLyBMaXN0ZW4gb24gYWxsIG5ldHdvcmsgaW50ZXJmYWNlcy5cbiAgICAgIHBvcnQ6IHBhcnNlSW50KHByb2Nlc3MuZW52LlZJVEVfUE9SVCB8fCAnMzAwMCcpLFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJy9hcGknOiB7XG4gICAgICAgICAgdGFyZ2V0OiBgaHR0cDovL2xvY2FsaG9zdDoke3Byb2Nlc3MuZW52LkJBQ0tFTkRfUE9SVCB8fCAnODAwMCd9YCxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgd2F0Y2g6IHsgdXNlUG9sbGluZzogdHJ1ZSwgaW50ZXJ2YWw6IDYwMCB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgICAvLyBWZW5kb3IgY2h1bmtzXG4gICAgICAgICAgICAncmVhY3QtdmVuZG9yJzogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgICAgICAgICAgICdyb3V0ZXItdmVuZG9yJzogWydyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgICAndWktdmVuZG9yJzogW1xuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWFjY29yZGlvbicsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtYWxlcnQtZGlhbG9nJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1hc3BlY3QtcmF0aW8nLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWF2YXRhcicsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtY2hlY2tib3gnLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWNvbGxhcHNpYmxlJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1jb250ZXh0LW1lbnUnLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtaG92ZXItY2FyZCcsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtbGFiZWwnLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LW1lbnViYXInLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LW5hdmlnYXRpb24tbWVudScsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtcG9wb3ZlcicsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtcHJvZ3Jlc3MnLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXJhZGlvLWdyb3VwJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zY3JvbGwtYXJlYScsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc2VsZWN0JyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZXBhcmF0b3InLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXNsaWRlcicsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc2xvdCcsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC10YWJzJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC10b2FzdCcsXG4gICAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlJyxcbiAgICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC10b2dnbGUtZ3JvdXAnLFxuICAgICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXAnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICdmb3JtLXZlbmRvcic6IFsncmVhY3QtaG9vay1mb3JtJywgJ0Bob29rZm9ybS9yZXNvbHZlcnMnLCAnem9kJ10sXG4gICAgICAgICAgICAndXRpbHMtdmVuZG9yJzogW1xuICAgICAgICAgICAgICAnYXhpb3MnLFxuICAgICAgICAgICAgICAnY2xzeCcsXG4gICAgICAgICAgICAgICd0YWlsd2luZC1tZXJnZScsXG4gICAgICAgICAgICAgICdjbGFzcy12YXJpYW5jZS1hdXRob3JpdHknLFxuICAgICAgICAgICAgICAnZGF0ZS1mbnMnLFxuICAgICAgICAgICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAncXVlcnktdmVuZG9yJzogWydAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcbiAgICB9LFxuICB9O1xufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXGNvZGVcXFxcQWdlbnQgRGlwbG9tYWN5XFxcXGFwcFxcXFxmcm9udGVuZFxcXFxwcmVyZW5kZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXGNvZGVcXFxcQWdlbnQgRGlwbG9tYWN5XFxcXGFwcFxcXFxmcm9udGVuZFxcXFxwcmVyZW5kZXJcXFxcYmxvZy1yb3V0ZXMuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L2NvZGUvQWdlbnQlMjBEaXBsb21hY3kvYXBwL2Zyb250ZW5kL3ByZXJlbmRlci9ibG9nLXJvdXRlcy5qc1wiO2ltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBzZW9Db250ZW50RGlyLCBub3JtYWxpemVSb3V0ZUZyb21NYXJrZG93biwgY29sbGVjdE1hcmtkb3duRmlsZXMgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJsb2dSb3V0ZXMoKSB7XG4gIGNvbnN0IHJvdXRlcyA9IG5ldyBTZXQoWycvYmxvZy8nXSk7XG5cbiAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBjb2xsZWN0TWFya2Rvd25GaWxlcyhzZW9Db250ZW50RGlyKSkge1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUoc2VvQ29udGVudERpciwgZmlsZVBhdGgpO1xuICAgIHJvdXRlcy5hZGQobm9ybWFsaXplUm91dGVGcm9tTWFya2Rvd24ocmVsYXRpdmVQYXRoKSk7XG4gIH1cblxuICByZXR1cm4gQXJyYXkuZnJvbShyb3V0ZXMpLnNvcnQoKTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcY29kZVxcXFxBZ2VudCBEaXBsb21hY3lcXFxcYXBwXFxcXGZyb250ZW5kXFxcXHByZXJlbmRlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcY29kZVxcXFxBZ2VudCBEaXBsb21hY3lcXFxcYXBwXFxcXGZyb250ZW5kXFxcXHByZXJlbmRlclxcXFx1dGlscy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovY29kZS9BZ2VudCUyMERpcGxvbWFjeS9hcHAvZnJvbnRlbmQvcHJlcmVuZGVyL3V0aWxzLmpzXCI7aW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XG5cbmNvbnN0IGN1cnJlbnRGaWxlID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGN1cnJlbnRGaWxlKTtcbmNvbnN0IHByb2plY3RSb290ID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJyk7XG5cbmV4cG9ydCBjb25zdCBzZW9Db250ZW50RGlyID0gcGF0aC5yZXNvbHZlKHByb2plY3RSb290LCAnc2VvJywgJ2NvbnRlbnQnKTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVJvdXRlRnJvbU1hcmtkb3duKHJlbGF0aXZlUGF0aCkge1xuICBjb25zdCBub3JtYWxpemVkID0gcmVsYXRpdmVQYXRoXG4gICAgLnJlcGxhY2UoL1xcXFwvZywgJy8nKVxuICAgIC5yZXBsYWNlKC9cXC9pbmRleFxcLm1kJC8sICcnKVxuICAgIC5yZXBsYWNlKC9cXC5tZCQvLCAnJyk7XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZWQgPyBgL2Jsb2cvJHtub3JtYWxpemVkfS9gIDogJy9ibG9nLyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0TWFya2Rvd25GaWxlcyhkaXIsIGJ1Y2tldCA9IFtdKSB7XG4gIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSB7XG4gICAgcmV0dXJuIGJ1Y2tldDtcbiAgfVxuXG4gIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICBpZiAoZW50cnkubmFtZS5zdGFydHNXaXRoKCcuJykpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpciwgZW50cnkubmFtZSk7XG4gICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgIGNvbGxlY3RNYXJrZG93bkZpbGVzKGZ1bGxQYXRoLCBidWNrZXQpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGVudHJ5LmlzRmlsZSgpICYmIGVudHJ5Lm5hbWUuZW5kc1dpdGgoJy5tZCcpKSB7XG4gICAgICBidWNrZXQucHVzaChmdWxsUGF0aCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1Y2tldDtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcY29kZVxcXFxBZ2VudCBEaXBsb21hY3lcXFxcYXBwXFxcXGZyb250ZW5kXFxcXHByZXJlbmRlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcY29kZVxcXFxBZ2VudCBEaXBsb21hY3lcXFxcYXBwXFxcXGZyb250ZW5kXFxcXHByZXJlbmRlclxcXFxibG9nLXNpdGVtYXAuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L2NvZGUvQWdlbnQlMjBEaXBsb21hY3kvYXBwL2Zyb250ZW5kL3ByZXJlbmRlci9ibG9nLXNpdGVtYXAuanNcIjtpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHsgc2VvQ29udGVudERpciwgbm9ybWFsaXplUm91dGVGcm9tTWFya2Rvd24sIGNvbGxlY3RNYXJrZG93bkZpbGVzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbmZ1bmN0aW9uIGNvbGxlY3RNYXJrZG93bkxhc3Rtb2QoZGlyKSB7XG4gIGNvbnN0IGJ1Y2tldCA9IHt9O1xuXG4gIGZvciAoY29uc3QgZnVsbFBhdGggb2YgY29sbGVjdE1hcmtkb3duRmlsZXMoZGlyKSkge1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUoc2VvQ29udGVudERpciwgZnVsbFBhdGgpO1xuICAgIGNvbnN0IHJvdXRlID0gbm9ybWFsaXplUm91dGVGcm9tTWFya2Rvd24ocmVsYXRpdmVQYXRoKTtcbiAgICBidWNrZXRbcm91dGVdID0gZnMuc3RhdFN5bmMoZnVsbFBhdGgpLm10aW1lO1xuICB9XG5cbiAgcmV0dXJuIGJ1Y2tldDtcbn1cblxuZnVuY3Rpb24gZ2V0TGF0ZXN0Q29udGVudE10aW1lKGxhc3Rtb2RNYXApIHtcbiAgY29uc3QgZGF0ZXMgPSBPYmplY3QudmFsdWVzKGxhc3Rtb2RNYXApLmZpbHRlcigodmFsdWUpID0+IHZhbHVlIGluc3RhbmNlb2YgRGF0ZSk7XG5cbiAgaWYgKGRhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICByZXR1cm4gbmV3IERhdGUoTWF0aC5tYXgoLi4uZGF0ZXMubWFwKChkYXRlKSA9PiBkYXRlLmdldFRpbWUoKSkpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNpdGVtYXBMYXN0bW9kKCkge1xuICBjb25zdCBjb250ZW50TGFzdG1vZCA9IGNvbGxlY3RNYXJrZG93bkxhc3Rtb2Qoc2VvQ29udGVudERpcik7XG4gIGNvbnN0IGxhdGVzdENvbnRlbnRNdGltZSA9IGdldExhdGVzdENvbnRlbnRNdGltZShjb250ZW50TGFzdG1vZCk7XG5cbiAgcmV0dXJuIHtcbiAgICAuLi4obGF0ZXN0Q29udGVudE10aW1lID8geyAnL2Jsb2cvJzogbGF0ZXN0Q29udGVudE10aW1lIH0gOiB7fSksXG4gICAgLi4uY29udGVudExhc3Rtb2QsXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTBTLFNBQVMsb0JBQW9CO0FBQ3ZVLE9BQU8sV0FBVztBQUNsQixPQUFPQSxTQUFRO0FBQ2YsT0FBT0MsV0FBVTtBQUNqQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFDdEIsU0FBUywyQkFBMkI7QUFDcEMsT0FBTyxhQUFhOzs7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QUEsSUFDUDtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBS0EsTUFBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQTtBQUFBLE1BQ04sTUFBTSxTQUFTLFFBQVEsSUFBSSxhQUFhLE1BQU07QUFBQSxNQUM5QyxPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRLG9CQUFvQixRQUFRLElBQUksZ0JBQWdCLE1BQU07QUFBQSxVQUM5RCxjQUFjO0FBQUEsUUFDaEI7QUFBQSxNQUNGO0FBQUEsTUFDQSxPQUFPLEVBQUUsWUFBWSxNQUFNLFVBQVUsSUFBSTtBQUFBLElBQzNDO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixjQUFjO0FBQUE7QUFBQSxZQUVaLGdCQUFnQixDQUFDLFNBQVMsV0FBVztBQUFBLFlBQ3JDLGlCQUFpQixDQUFDLGtCQUFrQjtBQUFBLFlBQ3BDLGFBQWE7QUFBQSxjQUNYO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxZQUNGO0FBQUEsWUFDQSxlQUFlLENBQUMsbUJBQW1CLHVCQUF1QixLQUFLO0FBQUEsWUFDL0QsZ0JBQWdCO0FBQUEsY0FDZDtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsWUFDRjtBQUFBLFlBQ0EsZ0JBQWdCLENBQUMsdUJBQXVCO0FBQUEsVUFDMUM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsdUJBQXVCO0FBQUEsSUFDekI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiZnMiLCAicGF0aCIsICJwYXRoIiwgIl9fZGlybmFtZSIsICJwYXRoIiwgImZzIiwgInBhdGgiLCAicGF0aCIsICJmcyIsICJwYXRoIiwgImZzIl0KfQo=
