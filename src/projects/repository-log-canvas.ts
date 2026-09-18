import { createColumnCanvasController } from "@lapismd/design-core/shadcn/column-canvas";

export function createRepositoryLogCanvas() {
  return createColumnCanvasController({
    columns: {
      revisions: {
        defaultWidth: 480,
        pathLevel: 0,
        minWidth: 360,
        maxWidth: 720,
        collapsible: true,
        resizable: true,
      },
      evolog: {
        defaultWidth: 480,
        pathLevel: 1,
        minWidth: 360,
        maxWidth: 720,
        closeable: true,
        resizable: true,
      },
      diff: {
        defaultWidth: 560,
        pathLevel: 2,
        minWidth: 360,
        maxWidth: 980,
        closeable: true,
        resizable: true,
      },
    },
  });
}
