import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { authGuard } from "./guards.js";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("../pages/LoginPage.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/approval/:id",
    name: "approval",
    component: () => import("../pages/ApprovalPage.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/",
    name: "dashboard",
    component: () => import("../pages/DashboardPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/workflows",
    name: "workflows",
    component: () => import("../pages/WorkflowsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/workflows/:id/canvas",
    name: "canvas",
    component: () => import("../pages/CanvasPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/workflows/:id/executions",
    name: "executions",
    component: () => import("../pages/ExecutionsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dlq",
    name: "dlq",
    component: () => import("../pages/DlqPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/marketplace",
    name: "marketplace",
    component: () => import("../pages/MarketplacePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/SettingsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/credentials",
    name: "credentials",
    component: () => import("../pages/CredentialsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/templates",
    name: "templates",
    component: () => import("../pages/TemplatesPage.vue"),
    meta: { requiresAuth: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(authGuard);

export default router;
