import type {
  AppCard,
  AppCardProps,
  BoardNode,
  CardProps,
  Shape,
  ShapeProps,
} from "@mirohq/websdk-types";
import { useFetcher } from "@remix-run/react";
import identity from "lodash.identity";
import React from "react";
import invariant from "tiny-invariant";
import { useMiroDrop } from "~/plugin-utils/use-miro-drop";
import { useNewKeyOnItemUpdates } from "./use-new-key-on-item-updates";
import { usePromiseState } from "./use-promise-state";
import { assertNever } from "./assertNever";
import classNames from "classnames";

export type ConnectedResponse<T extends ImplementedTypes> = {
  type: T;
  props: PropMap[T];
};
type PropMap = {
  card: CardProps;
  app_card: AppCardProps;
  shape: ShapeProps;
};

type ImplementedTypes = keyof PropMap;

async function findNodeByDataSource(
  type: ImplementedTypes,
  dataSource: string
) {
  const existingItems = await miro.board.get({ type });
  return existingItems.reduce(async (m, node) => {
    const match = await m;
    if (match && match.type === type) return match;

    if (node.type === type) {
      if ((await node.getMetadata("dataSource")) === dataSource) {
        return node;
      }
    }
  }, Promise.resolve(undefined as undefined | Extract<BoardNode, { type: ImplementedTypes }>));
}

async function createOrUpdate<Type extends ImplementedTypes>(
  type: Type,
  dataSource: string,
  props: PropMap[typeof type],
  node?: Extract<BoardNode, { type: Type }>
) {
  switch (node?.type) {
    case "app_card":
    case "card":
    case "shape": {
      const actual = await (node as AppCard).getMetadata("dataSource");
      invariant(
        actual === dataSource,
        () => `dataSource mismatch. Found: ${actual} Expected: ${dataSource}`
      );
      console.log("before", JSON.stringify(node, null, 2));
      Object.assign(node, props);
      console.log("after", JSON.stringify(node, null, 2));
      await node.sync();
      break;
    }
    default: {
      const withMeta = async (item: Promise<BoardNode>) => {
        ((await item) as Shape).setMetadata("dataSource", dataSource);
        return item;
      };
      console.log("create", type, props);

      // When calling this function, TS knows to associate "AppCard" with
      // "AppCardProps", but it's not convinced they match here.
      switch (type) {
        case "app_card":
          return withMeta(miro.board.createAppCard(props as AppCardProps));
        case "card":
          return withMeta(miro.board.createCard(props as CardProps));
        case "shape":
          return withMeta(miro.board.createShape(props as ShapeProps));
        default:
          assertNever(type);
      }
    }
  }
}
type Props<Type extends keyof PropMap> = {
  apiEndpoint: string;
  type: Type;
  Component: React.ComponentType<
    PropMap[Type] & {
      node?: Extract<BoardNode, { type: Type }>;
    }
  >;
};

export function ConnectedBoardItem<T extends ImplementedTypes>({
  apiEndpoint,
  Component,
  type,
}: Props<T>) {
  const key = useNewKeyOnItemUpdates();
  const node = usePromiseState(async () => {
    if (key) {
      return findNodeByDataSource(type, apiEndpoint);
    }
  }, [type, apiEndpoint, key]);

  const fetcher = useFetcher<{
    type: ImplementedTypes;
    props: PropMap[ImplementedTypes];
  }>();

  React.useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load(apiEndpoint);
    }
  }, [apiEndpoint, fetcher]);

  const self = React.useRef<HTMLDivElement>(null);
  useMiroDrop(async ({ x, y, target }) => {
    if (!target.contains(self.current!)) {
      return;
    }

    let position: { x?: number; y?: number } = { x, y };
    if (node.value?.parentId) {
      delete position.x;
      delete position.y;
    } else if (node.value) {
      position.x = node.value.x;
      position.y = node.value.y;
    }

    console.log({
      ...fetcher.data?.props,
      ...position,
    });

    createOrUpdate(
      type,
      apiEndpoint,
      // @ts-expect-error
      {
        ...fetcher.data?.props,
        ...position,
      },
      node.state === "resolved" ? (node.value as any) : undefined
    );
  });

  // @ts-expect-error
  let data: PropMap[T] = fetcher.data?.props ?? loadingProps(type);

  if (fetcher.data && fetcher.data?.type !== type) {
    throw new Error(
      "type mismatch. expected " + type + " got " + fetcher.data?.type
    );
  }

  const viewOnBoard = () => {
    if (node.state === "resolved" && node.value) {
      // TODO: See if the node is in a frame and zoom to the frame instead

      miro.board.viewport.zoomTo([node.value]);
    }
  };

  const diff = React.useMemo(() => {
    if (key && fetcher.data && node.state === "resolved" && node.value) {
      const n = node.value;
      const keys = Object.keys(fetcher.data.props);
      return keys.filter((k) => {
        // @ts-expect-error
        const currentValue = JSON.stringify(fetcher.data.props[k]);
        // @ts-expect-error
        const nodeValue = JSON.stringify(n[k]);

        return currentValue !== nodeValue;
      });
    }
    return [];
  }, [fetcher.data, key, node.state, node.value]);

  return (
    <div ref={self} className="miro-draggable">
      <button
        disabled={node.state !== "resolved"}
        className={classNames("button button-small button-primary", {
          "button-loading": node.state === "running",
        })}
        onClick={viewOnBoard}
      >
        <div>
          View on board
          {node.state === "timeout" && (
            <span className="label label-warning">Timeout</span>
          )}
        </div>
      </button>
      {diff.length > 0 && (
        <div>
          Updates Available (Drag the card onto the board to apply):
          <ul>
            {diff.map((key) => (
              <li
                key={key}
                style={{ display: "flex", flexDirection: "column" }}
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Component {...data} />
    </div>
  );
}
function loadingProps(type: ImplementedTypes): PropMap[ImplementedTypes] {
  switch (type) {
    case "app_card": {
      return identity<AppCardProps>({
        title: "loading...",
      });
    }
    case "card": {
      return identity<CardProps>({
        title: "loading...",
      });
    }
    case "shape": {
      return identity<ShapeProps>({
        content: "loading...",
      });
    }
    default:
      assertNever(type);
  }
}
