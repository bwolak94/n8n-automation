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
    path: "/",
    name: "home",
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
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(authGuard);

export default router;
