import type { NavigationGuard } from "vue-router";
import { useAuthStore } from "../stores/authStore.js";

/**
 * Redirect unauthenticated users to /login.
 * Redirect authenticated users away from /login to /.
 */
export const authGuard: NavigationGuard = (to) => {
  const authStore = useAuthStore();

  if (to.meta["requiresAuth"] === true && !authStore.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.name === "login" && authStore.isAuthenticated) {
    return { name: "dashboard" };
  }

  return true;
};
