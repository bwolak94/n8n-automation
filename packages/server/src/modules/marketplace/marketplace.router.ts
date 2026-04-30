import { Router } from "express";
import type { MarketplaceController } from "./MarketplaceController.js";
import type { IntegrationController } from "./IntegrationController.js";

export function createMarketplaceRouter(
  controller: MarketplaceController,
  integrationController: IntegrationController
): Router {
  const router = Router();

  // ── Node packages ──────────────────────────────────────────────────────────

  // Public catalogue (still requires auth for tenant context)
  router.get("/nodes", controller.listPackages);

  // Publish a new community node package
  router.post("/nodes", controller.publishPackage);

  // Install / uninstall into the current tenant workspace
  router.post("/nodes/:id/install", controller.installPackage);
  router.delete("/nodes/:id/install", controller.uninstallPackage);

  // List installed nodes for the current tenant
  router.get("/installed", controller.listInstalled);

  // ── Integration templates (premade workflows) ──────────────────────────────

  // Browse approved templates
  router.get("/templates", integrationController.listTemplates);

  // Get template details
  router.get("/templates/:id", integrationController.getTemplate);

  // Clone a template into the current tenant workspace
  router.post("/templates/:id/install", integrationController.installTemplate);

  // Publish a workflow as a community template
  router.post("/templates", integrationController.publishTemplate);

  return router;
}
