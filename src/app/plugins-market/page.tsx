"use client";

import { PluginMarketplaceBrowser } from "@/components/plugins/marketplace/PluginMarketplaceBrowser";

export default function PluginsMarketPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold">Plugins</h3>
        </div>
        <PluginMarketplaceBrowser />
      </div>
    </div>
  );
}
