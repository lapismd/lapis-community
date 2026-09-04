import "@lapismd/design-core/styles.css";

import { mount } from "svelte";

import CommunityDevApp from "./CommunityDevApp.svelte";
import "./styles.css";

const target = document.querySelector<HTMLElement>("#app");
if (target === null)
  throw new Error("Community development app root is missing");

mount(CommunityDevApp, { target });
