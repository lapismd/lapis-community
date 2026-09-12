const path = require("node:path");
const fs = require("node:fs");

const localPackages = new Map([
  [
    "@lapismd/design-core",
    "file:../design-core/.local/packages/lapismd-design-core-0.1.2-96db2dc96ada.tgz",
  ],
]);

module.exports = {
  hooks: {
    readPackage(packageManifest) {
      for (const field of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
      ]) {
        const dependencies = packageManifest[field];
        if (!dependencies) continue;
        for (const [packageName, localTarball] of localPackages) {
          if (
            dependencies[packageName] &&
            fs.existsSync(path.resolve(__dirname, localTarball.slice(5)))
          ) {
            dependencies[packageName] = localTarball;
          }
        }
      }
      return packageManifest;
    },
  },
};
