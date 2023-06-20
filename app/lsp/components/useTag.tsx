import type { TagProps } from "@mirohq/websdk-types";
import React from "react";

export function useTag(
  title: string | undefined,
  color: TagProps["color"] = "blue"
) {
  const [id, setId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!title) {
      return;
    }

    const run = async () => {
      const tags = await miro.board.get({ type: "tag" });
      let tag = tags.find((t) => t.title === title);

      if (!tag) {
        tag = await miro.board.createTag({
          title,
          type: "tag",
          color,
        });
      }
      setId(tag.id);
    };
    run().catch((e) => console.error(`error creating tag: ${title}`, e));
  }, [color, title]);

  return id;
}
