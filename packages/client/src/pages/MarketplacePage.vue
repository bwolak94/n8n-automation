<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import AppLayout from "../shared/components/AppLayout.vue";
import MarketplaceBrowser from "../features/marketplace/components/MarketplaceBrowser.vue";
import InstalledNodesPanel from "../features/marketplace/components/InstalledNodesPanel.vue";
import IntegrationsBrowser from "../features/marketplace/components/IntegrationsBrowser.vue";
import PublishTemplateModal from "../features/marketplace/components/PublishTemplateModal.vue";
import {
  listMarketplacePackages,
  installPackage,
  uninstallPackage,
  listInstalledNodes,
  type MarketplacePackage,
  type InstalledNode,
  type ListPackagesQuery,
} from "../shared/api/marketplace.js";
import {
  listIntegrationTemplates,
  installIntegrationTemplate,
  publishIntegrationTemplate,
  type IntegrationTemplate,
  type PublishTemplateInput,
} from "../shared/api/integrations.js";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const activeTab = ref<"integrations" | "nodes" | "installed">("integrations");

// ─── Node packages state ──────────────────────────────────────────────────────

const packages       = ref<MarketplacePackage[]>([]);
const installedNodes = ref<InstalledNode[]>([]);
const loadingPackages  = ref(false);
const loadingInstalled = ref(false);
const installingId   = ref<string | null>(null);
const uninstallingId = ref<string | null>(null);

// ─── Integration templates state ──────────────────────────────────────────────

const templates           = ref<IntegrationTemplate[]>([]);
const loadingTemplates    = ref(false);
const installingTemplate  = ref<string | null>(null);
const showPublishModal    = ref(false);

// ─── Shared error ─────────────────────────────────────────────────────────────

const error = ref<string | null>(null);

// ─── Derived ──────────────────────────────────────────────────────────────────

const installedPackageIds = computed(() =>
  installedNodes.value.map((n) => n.packageId)
);

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadTemplates(): Promise<void> {
  loadingTemplates.value = true;
  error.value = null;
  try {
    const result = await listIntegrationTemplates({ sort: "installs" });
    templates.value = result.items;
  } catch {
    error.value = "Failed to load integration templates.";
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadPackages(query: ListPackagesQuery = {}): Promise<void> {
  loadingPackages.value = true;
  error.value = null;
  try {
    const result = await listMarketplacePackages(query);
    packages.value = result.items;
  } catch {
    error.value = "Failed to load packages.";
  } finally {
    loadingPackages.value = false;
  }
}

async function loadInstalled(): Promise<void> {
  loadingInstalled.value = true;
  try {
    const result = await listInstalledNodes();
    installedNodes.value = result.items;
  } catch {
    // non-critical
  } finally {
    loadingInstalled.value = false;
  }
}

onMounted(() => {
  loadTemplates();
  loadPackages();
  loadInstalled();
});

// ─── Integration actions ──────────────────────────────────────────────────────

async function onInstallTemplate(templateId: string, workflowName: string): Promise<void> {
  installingTemplate.value = templateId;
  error.value = null;
  try {
    await installIntegrationTemplate(templateId, { workflowName });
  } catch {
    error.value = "Failed to add integration template.";
  } finally {
    installingTemplate.value = null;
  }
}

async function onPublishTemplate(data: PublishTemplateInput): Promise<void> {
  error.value = null;
  try {
    await publishIntegrationTemplate(data);
    showPublishModal.value = false;
  } catch {
    error.value = "Failed to submit template for review.";
  }
}

// ─── Node package actions ─────────────────────────────────────────────────────

async function onInstall(packageId: string): Promise<void> {
  installingId.value = packageId;
  error.value = null;
  try {
    const record = await installPackage(packageId);
    installedNodes.value = [...installedNodes.value, record];
  } catch {
    error.value = "Failed to install package.";
  } finally {
    installingId.value = null;
  }
}

async function onUninstall(packageId: string): Promise<void> {
  uninstallingId.value = packageId;
  error.value = null;
  try {
    await uninstallPackage(packageId);
    installedNodes.value = installedNodes.value.filter((n) => n.packageId !== packageId);
  } catch {
    error.value = "Failed to uninstall package.";
  } finally {
    uninstallingId.value = null;
  }
}
</script>

<template>
  <AppLayout>
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">Marketplace</h1>
          <p class="text-sm text-gray-400">
            Browse premade integrations or install custom nodes for your workflows
          </p>
        </div>
        <button
          v-if="activeTab === 'integrations'"
          class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          data-testid="publish-template-btn"
          @click="showPublishModal = true"
        >
          Publish Template
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-5xl">

        <!-- Error banner -->
        <div
          v-if="error"
          class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
          data-testid="error-banner"
        >
          {{ error }}
        </div>

        <!-- Tabs -->
        <div class="mb-6 flex gap-1 border-b border-gray-200">
          <button
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === 'integrations'
              ? 'border-b-2 border-violet-600 text-violet-700'
              : 'text-gray-500 hover:text-gray-800'"
            data-testid="tab-integrations"
            @click="activeTab = 'integrations'"
          >
            Integrations
          </button>
          <button
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === 'nodes'
              ? 'border-b-2 border-violet-600 text-violet-700'
              : 'text-gray-500 hover:text-gray-800'"
            data-testid="tab-nodes"
            @click="activeTab = 'nodes'"
          >
            Node Packages
          </button>
          <button
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === 'installed'
              ? 'border-b-2 border-violet-600 text-violet-700'
              : 'text-gray-500 hover:text-gray-800'"
            data-testid="tab-installed"
            @click="activeTab = 'installed'"
          >
            Installed Nodes
            <span
              v-if="installedNodes.length > 0"
              class="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700"
            >
              {{ installedNodes.length }}
            </span>
          </button>
        </div>

        <!-- Integrations tab — premade workflow templates -->
        <IntegrationsBrowser
          v-if="activeTab === 'integrations'"
          :templates="templates"
          :loading="loadingTemplates"
          :installing="installingTemplate"
          @install="onInstallTemplate"
          @search="loadTemplates"
        />

        <!-- Node packages tab -->
        <MarketplaceBrowser
          v-else-if="activeTab === 'nodes'"
          :packages="packages"
          :installed-package-ids="installedPackageIds"
          :loading="loadingPackages"
          :installing="installingId"
          @install="onInstall"
          @search="(q) => loadPackages({ search: q })"
        />

        <!-- Installed nodes tab -->
        <InstalledNodesPanel
          v-else
          :installed-nodes="installedNodes"
          :loading="loadingInstalled"
          :uninstalling="uninstallingId"
          @uninstall="onUninstall"
        />

      </div>
    </main>

    <!-- Publish template modal -->
    <PublishTemplateModal
      v-if="showPublishModal"
      @publish="onPublishTemplate"
      @cancel="showPublishModal = false"
    />
  </AppLayout>
</template>
