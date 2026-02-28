import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import type { MarketplacePlugin, PluginComponents } from "@/types";

function getMarketplacesDir(): string {
  return path.join(os.homedir(), ".claude", "plugins", "marketplaces");
}

function getInstalledPlugins(): Map<string, { scope: string }> {
  const installed = new Map<string, { scope: string }>();

  // Read from ~/.claude/settings.json
  const settingsFiles: Array<{ path: string; scope: string }> = [
    { path: path.join(os.homedir(), ".claude", "settings.json"), scope: "user" },
  ];

  for (const sf of settingsFiles) {
    try {
      if (!fs.existsSync(sf.path)) continue;
      const raw = JSON.parse(fs.readFileSync(sf.path, "utf-8"));
      const plugins = raw.enabledPlugins || raw.plugins || {};
      if (typeof plugins === "object") {
        for (const name of Object.keys(plugins)) {
          installed.set(name, { scope: sf.scope });
        }
      }
      // Also check array format
      if (Array.isArray(plugins)) {
        for (const p of plugins) {
          const name = typeof p === "string" ? p : p?.name;
          if (name) installed.set(name, { scope: sf.scope });
        }
      }
    } catch {
      // ignore
    }
  }

  return installed;
}

function detectComponents(pluginDir: string): PluginComponents {
  return {
    hasSkills: fs.existsSync(path.join(pluginDir, "skills")),
    hasAgents: fs.existsSync(path.join(pluginDir, "agents")),
    hasHooks:
      fs.existsSync(path.join(pluginDir, "hooks")) ||
      fs.existsSync(path.join(pluginDir, "hooks.json")),
    hasMcp: fs.existsSync(path.join(pluginDir, ".mcp.json")),
    hasLsp: fs.existsSync(path.join(pluginDir, ".lsp.json")),
    hasCommands: fs.existsSync(path.join(pluginDir, "commands")),
  };
}

function readPluginManifest(
  pluginDir: string
): Record<string, unknown> | null {
  const manifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
  try {
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

function readMarketplaceJson(
  marketplaceDir: string
): Record<string, unknown> | null {
  // Try .claude-plugin/marketplace.json first
  const p1 = path.join(marketplaceDir, ".claude-plugin", "marketplace.json");
  const p2 = path.join(marketplaceDir, "marketplace.json");
  for (const p of [p1, p2]) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").toLowerCase();
    const category = request.nextUrl.searchParams.get("category") || "";

    const marketplacesDir = getMarketplacesDir();
    const installedPlugins = getInstalledPlugins();
    const plugins: MarketplacePlugin[] = [];

    if (!fs.existsSync(marketplacesDir)) {
      return NextResponse.json({ plugins: [] });
    }

    const marketplaces = fs.readdirSync(marketplacesDir, {
      withFileTypes: true,
    });

    for (const mkt of marketplaces) {
      if (!mkt.isDirectory()) continue;
      const mktDir = path.join(marketplacesDir, mkt.name);
      const mktJson = readMarketplaceJson(mktDir);
      const marketplaceName = (mktJson?.name as string) || mkt.name;

      // Scan plugins directory
      const pluginsDir = path.join(mktDir, "plugins");
      if (!fs.existsSync(pluginsDir)) continue;

      let pluginEntries: fs.Dirent[];
      try {
        pluginEntries = fs.readdirSync(pluginsDir, { withFileTypes: true });
      } catch {
        continue;
      }

      // Also get plugin info from marketplace.json if available
      const mktPluginList = Array.isArray(mktJson?.plugins)
        ? (mktJson.plugins as Array<Record<string, unknown>>)
        : [];
      const mktPluginMap = new Map<string, Record<string, unknown>>();
      for (const mp of mktPluginList) {
        if (mp.name) mktPluginMap.set(String(mp.name), mp);
      }

      for (const entry of pluginEntries) {
        if (!entry.isDirectory()) continue;
        const pluginDir = path.join(pluginsDir, entry.name);
        const manifest = readPluginManifest(pluginDir);
        const mktEntry = mktPluginMap.get(entry.name);

        const name = (manifest?.name as string) || entry.name;
        const description =
          (manifest?.description as string) ||
          (mktEntry?.description as string) ||
          "";
        const version =
          (manifest?.version as string) ||
          (mktEntry?.version as string) ||
          undefined;
        const authorObj = (manifest?.author || mktEntry?.author) as
          | { name: string; email?: string; url?: string }
          | string
          | undefined;
        const author =
          typeof authorObj === "string"
            ? { name: authorObj }
            : authorObj || undefined;
        const cat =
          (manifest?.category as string) ||
          (mktEntry?.category as string) ||
          undefined;

        const components = detectComponents(pluginDir);
        const isInstalled = installedPlugins.has(name);
        const installedInfo = installedPlugins.get(name);

        const plugin: MarketplacePlugin = {
          name,
          description,
          version,
          author,
          marketplace: marketplaceName,
          category: cat,
          components,
          isInstalled,
          installedScope: installedInfo?.scope as
            | "user"
            | "project"
            | "local"
            | undefined,
        };

        // Apply filters
        if (q) {
          const searchable = `${name} ${description} ${cat || ""}`.toLowerCase();
          if (!searchable.includes(q)) continue;
        }
        if (category && cat !== category) continue;

        plugins.push(plugin);
      }
    }

    return NextResponse.json({ plugins });
  } catch (error) {
    console.error("[plugins/marketplace/browse] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to browse plugins",
      },
      { status: 500 }
    );
  }
}
