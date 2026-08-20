import { createTLSchema } from "@tldraw/tlschema";
import { T } from "@tldraw/validate";

/** Extra tldraw shape types for live Kanban embeds. Must match the client ShapeUtils. */
export function createKanbanAwareSchema() {
  const box = {
    w: T.number,
    h: T.number,
    boardId: T.string,
  };

  return createTLSchema({
    shapes: {
      "kanban-card": {
        props: {
          ...box,
          cardId: T.string,
        },
      },
      "kanban-column": {
        props: {
          ...box,
          columnId: T.string,
        },
      },
    },
  });
}
