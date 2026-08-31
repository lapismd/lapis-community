import RegistryCommunity from "./RegistryCommunity.svelte";

const RegistryCommunityElement = (
  RegistryCommunity as typeof RegistryCommunity & {
    element: CustomElementConstructor;
  }
).element;

if (!customElements.get("lapis-registry-community")) {
  customElements.define("lapis-registry-community", RegistryCommunityElement);
}
