import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { router } from "./router/index.js";
import { i18n } from "./shared/i18n/index.js";
import App from "./App.vue";
import "./style.css";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(VueQueryPlugin);

app.mount("#app");
