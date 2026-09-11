import { mount } from "svelte";
import "@lapismd/design-core/styles.css";
import "../../src/components/community-typography.css";
import App from "./App.svelte";
mount(App, { target: document.getElementById("app")! });
